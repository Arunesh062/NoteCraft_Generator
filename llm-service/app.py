import os
import time
import uuid
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

MODEL_NAME = os.getenv("MODEL_NAME", os.getenv("LLM_MODEL", "meta-llama/Llama-3.2-3B-Instruct"))
PORT = int(os.getenv("PORT", "8001"))
TENSOR_PARALLEL_SIZE = int(os.getenv("TENSOR_PARALLEL_SIZE", "1"))
GPU_MEMORY_UTILIZATION = float(os.getenv("GPU_MEMORY_UTILIZATION", "0.90"))
MAX_MODEL_LEN = int(os.getenv("MAX_MODEL_LEN", "4096"))

app = FastAPI(
    title="NoteCraft vLLM Inference Service",
    description="Separate LLM inference service using vLLM for Llama 3.2 3B",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global vLLM engine reference
llm_engine = None


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatCompletionRequest(BaseModel):
    model: Optional[str] = MODEL_NAME
    messages: List[ChatMessage]
    max_tokens: Optional[int] = 2000
    temperature: Optional[float] = 0.3
    top_p: Optional[float] = 0.95
    n: Optional[int] = 1
    stream: Optional[bool] = False
    response_format: Optional[Dict[str, Any]] = None


@app.on_event("startup")
async def startup_event():
    global llm_engine
    print(f"Initializing vLLM engine with model: {MODEL_NAME}...")
    try:
        from vllm.engine.arg_utils import AsyncEngineArgs
        from vllm.engine.async_llm_engine import AsyncLLMEngine

        engine_args = AsyncEngineArgs(
            model=MODEL_NAME,
            tensor_parallel_size=TENSOR_PARALLEL_SIZE,
            gpu_memory_utilization=GPU_MEMORY_UTILIZATION,
            max_model_len=MAX_MODEL_LEN,
            trust_remote_code=True,
        )
        llm_engine = AsyncLLMEngine.from_engine_args(engine_args)
        print(f"vLLM engine successfully initialized for {MODEL_NAME}!")
    except ImportError:
        print("WARNING: vllm package not installed. The LLM service is running in standby/stub mode.")
        print("Install vllm on a supported GPU environment to enable live model inference.")
    except Exception as e:
        print(f"WARNING: Failed to initialize vLLM engine: {e}")
        print("Service running, but LLM calls will fail until engine is properly configured.")


@app.get("/")
async def root():
    return {
        "service": "NoteCraft LLM Service",
        "engine": "vLLM",
        "model": MODEL_NAME,
        "status": "ready" if llm_engine is not None else "engine_not_initialized"
    }


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "model": MODEL_NAME,
        "engine_ready": llm_engine is not None
    }


@app.post("/v1/chat/completions")
async def chat_completions(request: ChatCompletionRequest):
    if llm_engine is None:
        raise HTTPException(
            status_code=503,
            detail="vLLM engine is not initialized. Ensure vLLM is installed and CUDA GPU is available."
        )

    from vllm.sampling_params import SamplingParams

    # Format prompt from chat messages
    prompt = ""
    for msg in request.messages:
        if msg.role == "system":
            prompt += f"<|system|>\n{msg.content}\n"
        elif msg.role == "user":
            prompt += f"<|user|>\n{msg.content}\n"
        elif msg.role == "assistant":
            prompt += f"<|assistant|>\n{msg.content}\n"
    prompt += "<|assistant|>\n"

    request_id = f"chatcmpl-{uuid.uuid4().hex}"

    sampling_params = SamplingParams(
        temperature=request.temperature or 0.3,
        max_tokens=request.max_tokens or 2000,
        top_p=request.top_p or 0.95,
    )

    try:
        results_generator = llm_engine.generate(prompt, sampling_params, request_id)
        final_output = None
        async for request_output in results_generator:
            final_output = request_output

        text_output = final_output.outputs[0].text if final_output and final_output.outputs else ""

        prompt_tokens = len(final_output.prompt_token_ids) if final_output and hasattr(final_output, "prompt_token_ids") else len(prompt.split())
        completion_tokens = len(final_output.outputs[0].token_ids) if final_output and final_output.outputs and hasattr(final_output.outputs[0], "token_ids") else len(text_output.split())

        return {
            "id": request_id,
            "object": "chat.completion",
            "created": int(time.time()),
            "model": request.model or MODEL_NAME,
            "choices": [
                {
                    "index": 0,
                    "message": {
                        "role": "assistant",
                        "content": text_output,
                    },
                    "finish_reason": "stop"
                }
            ],
            "usage": {
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "total_tokens": prompt_tokens + completion_tokens
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"vLLM inference error: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=PORT, reload=True)
