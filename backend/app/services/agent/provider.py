"""
LLM Provider integration for OrgMind Agent.
Connects securely to configured LLM providers (Groq, OpenAI, Gemini) via httpx.
Protects credentials from being logged, exposed, or leaked.
"""

from __future__ import annotations
import json
import logging
from typing import Any, Dict, List, Optional, Tuple
import httpx

from app.config import get_settings

logger = logging.getLogger("orgmind.agent.provider")


class LLMProvider:
    def __init__(self):
        self.settings = get_settings()

    def get_active_provider(self) -> Tuple[Optional[str], Optional[str]]:
        """
        Determine active provider and model without revealing secrets.
        Returns (provider_name, model_name) or (None, None).
        """
        if self.settings.groq_api_key:
            return "groq", "qwen/qwen3.8-27b"
        elif self.settings.openai_api_key:
            return "openai", "gpt-4o-mini"
        elif self.settings.gemini_api_key:
            return "gemini", "gemini-1.5-flash"
        return None, None

    def call_chat_completion(
        self,
        messages: List[Dict[str, Any]],
        tools: Optional[List[Dict[str, Any]]] = None,
        temperature: float = 0.1,
        timeout: float = 20.0
    ) -> Dict[str, Any]:
        """
        Execute chat completion with function tools.
        Returns:
            {
                "success": bool,
                "role": "assistant",
                "content": Optional[str],
                "tool_calls": Optional[List[Dict[str, Any]]],
                "provider": str,
                "error": Optional[str]
            }
        """
        provider, model = self.get_active_provider()
        if not provider:
            return {
                "success": False,
                "error": "No LLM provider configured (set GROQ_API_KEY, OPENAI_API_KEY, or GEMINI_API_KEY).",
                "provider": "none"
            }

        try:
            if provider == "groq":
                return self._call_openai_compatible(
                    endpoint="https://api.groq.com/openai/v1/chat/completions",
                    api_key=self.settings.groq_api_key,
                    model=model,
                    messages=messages,
                    tools=tools,
                    temperature=temperature,
                    timeout=timeout,
                    provider_name="groq"
                )
            elif provider == "openai":
                return self._call_openai_compatible(
                    endpoint="https://api.openai.com/v1/chat/completions",
                    api_key=self.settings.openai_api_key,
                    model=model,
                    messages=messages,
                    tools=tools,
                    temperature=temperature,
                    timeout=timeout,
                    provider_name="openai"
                )
            elif provider == "gemini":
                # For Gemini, use OpenAI-compatible endpoint v1beta/openai/chat/completions
                return self._call_openai_compatible(
                    endpoint="https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
                    api_key=self.settings.gemini_api_key,
                    model=model,
                    messages=messages,
                    tools=tools,
                    temperature=temperature,
                    timeout=timeout,
                    provider_name="gemini"
                )
            else:
                return {
                    "success": False,
                    "error": f"Unsupported provider: {provider}",
                    "provider": provider
                }
        except httpx.TimeoutException:
            logger.warning(f"LLM provider '{provider}' timed out after {timeout}s.")
            return {
                "success": False,
                "error": f"LLM provider '{provider}' timed out after {timeout}s.",
                "provider": provider
            }
        except Exception as e:
            logger.error(f"Error calling LLM provider '{provider}': {e}")
            return {
                "success": False,
                "error": str(e),
                "provider": provider
            }

    def _call_openai_compatible(
        self,
        endpoint: str,
        api_key: str,
        model: str,
        messages: List[Dict[str, Any]],
        tools: Optional[List[Dict[str, Any]]],
        temperature: float,
        timeout: float,
        provider_name: str
    ) -> Dict[str, Any]:
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        payload: Dict[str, Any] = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": 1500
        }
        if tools:
            payload["tools"] = tools
            payload["tool_choice"] = "auto"

        with httpx.Client(timeout=timeout) as client:
            resp = client.post(endpoint, headers=headers, json=payload)
            if resp.status_code == 429 and provider_name == "groq" and model != "openai/gpt-oss-20b":
                logger.info(f"Groq model {model} rate limited; retrying with backup model openai/gpt-oss-20b")
                payload["model"] = "openai/gpt-oss-20b"
                resp = client.post(endpoint, headers=headers, json=payload)

            if resp.status_code != 200:
                err_text = resp.text
                logger.warning(f"Provider {provider_name} returned status {resp.status_code}: {err_text[:200]}")
                return {
                    "success": False,
                    "error": f"Provider {provider_name} HTTP {resp.status_code}: {resp.status_code}",
                    "provider": provider_name
                }

            data = resp.json()
            choice = data["choices"][0]
            msg = choice.get("message", {})

            return {
                "success": True,
                "role": "assistant",
                "content": msg.get("content"),
                "tool_calls": msg.get("tool_calls"),
                "provider": provider_name,
                "model": payload.get("model", model)
            }
