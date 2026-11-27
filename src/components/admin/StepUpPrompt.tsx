"use client";

import { useEffect } from "react";
import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import Swal from "sweetalert2";
import toast from "react-hot-toast";
import { apiErrorMessage } from "@/lib/api-error";

type Retryable = InternalAxiosRequestConfig & { _stepUpRetried?: boolean };

/**
 * Sensitive admin actions answer 403 `STEP_UP_REQUIRED` when the admin has not
 * entered a two-factor code in the last 15 minutes. This asks for a code,
 * verifies it, and repeats the original request, so every admin page gets the
 * prompt without changing its own code. If the login itself is no longer
 * verified, it sends the admin to the security page instead.
 */
export default function StepUpPrompt() {
  useEffect(() => {
    const id = axios.interceptors.response.use(
      (response) => response,
      async (error: AxiosError<{ code?: string }>) => {
        const config = error.config as Retryable | undefined;
        const code = error.response?.data?.code;
        if (error.response?.status !== 403 || !config) return Promise.reject(error);

        if (code === "MFA_REQUIRED" || code === "MFA_SETUP_REQUIRED") {
          window.location.href = "/admin/security";
          return Promise.reject(error);
        }
        if (code !== "STEP_UP_REQUIRED" || config._stepUpRetried) return Promise.reject(error);

        const { value, isConfirmed } = await Swal.fire({
          title: "Confirm it's you",
          text: "Enter the 6-digit code from your authenticator app, or a recovery code.",
          input: "text",
          inputAttributes: { autocomplete: "one-time-code", inputmode: "text" },
          showCancelButton: true,
          confirmButtonText: "Confirm",
          confirmButtonColor: "#1a4731",
        });
        if (!isConfirmed || !value) return Promise.reject(error);

        try {
          await axios.post("/api/v1/admin/mfa/verify", { code: value });
        } catch (verifyError) {
          toast.error(apiErrorMessage(verifyError, "Could not verify the code"));
          return Promise.reject(error);
        }
        config._stepUpRetried = true;
        return axios(config);
      },
    );
    return () => axios.interceptors.response.eject(id);
  }, []);

  return null;
}
