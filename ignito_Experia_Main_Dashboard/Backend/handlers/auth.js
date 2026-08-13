import { authService } from "../services/AuthService.js";
import { ok, badRequest, serverError } from "../lib/apigw.js";
import Joi from "joi";

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(1).required(),
});

export async function loginHandler(req, res) {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      const resp = badRequest(error.details[0].message);
      return res.status(resp.statusCode).json(resp.body);
    }

    const result = await authService.login(value.email, value.password);
    const resp = ok({ success: true, ...result });
    return res.status(resp.statusCode).json(resp.body);
  } catch (err) {
    console.error("[loginHandler]", err.message);
    if (err.message === "Invalid email or password") {
      const resp = badRequest("Invalid email or password");
      return res.status(resp.statusCode).json(resp.body);
    }
    const resp = serverError({ success: false, message: err.message });
    return res.status(resp.statusCode).json(resp.body);
  }
}

export async function meHandler(req, res) {
  try {
    const user = req.auth;
    return res.status(200).json({ success: true, user });
  } catch (err) {
    const resp = serverError({ success: false, message: err.message });
    return res.status(resp.statusCode).json(resp.body);
  }
}

export async function getProfileHandler(req, res) {
  try {
    const ownerId = req.auth?.ownerId || req.auth?.userId;
    if (!ownerId) {
      const resp = badRequest("Invalid user token context");
      return res.status(resp.statusCode).json(resp.body);
    }

    const profile = await authService.getProfile(ownerId);
    const resp = ok({ success: true, profile });
    return res.status(resp.statusCode).json(resp.body);
  } catch (err) {
    console.error("[getProfileHandler]", err.message);
    const resp = serverError({ success: false, message: err.message });
    return res.status(resp.statusCode).json(resp.body);
  }
}

export async function updateProfileHandler(req, res) {
  try {
    const ownerId = req.auth?.ownerId || req.auth?.userId;
    if (!ownerId) {
      const resp = badRequest("Invalid user token context");
      return res.status(resp.statusCode).json(resp.body);
    }

    const result = await authService.updateProfile(ownerId, req.body || {});
    const resp = ok({ success: true, ...result });
    return res.status(resp.statusCode).json(resp.body);
  } catch (err) {
    console.error("[updateProfileHandler]", err.message);
    const resp = serverError({ success: false, message: err.message });
    return res.status(resp.statusCode).json(resp.body);
  }
}

