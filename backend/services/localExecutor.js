// DEPRECATED & DELETED: Local code execution is disabled. All code runs must execute inside the container runtime.
export const executeLocally = async () => {
  return {
    success: false,
    output: "",
    error: "Local execution fallback is disabled. Running code requires a valid, running lab container.",
  };
};
