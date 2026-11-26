package com.openframe.authz.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;

/**
 * Simple login page controller for multi-tenant OpenFrame
 */
@Controller
public class LoginController {

    @Value("${openframe.password-reset.page-url:}")
    private String passwordResetPageUrl;

    /**
     * reCAPTCHA Enterprise site key. The edge firewall refuses the password-reset request without a token, so the
     * page asks Google for one before sending it. Blank (self-hosted) sends the request without one, as before.
     */
    @Value("${openframe.recaptcha.site-key:}")
    private String recaptchaSiteKey;

    @Value("${openframe.recaptcha.session-site-key:}")
    private String recaptchaSessionSiteKey;

    @GetMapping("/login")
    public String login(Model model,
                        @RequestParam(value = "error", required = false) String error) {

        if (error != null) {
            model.addAttribute("errorMessage", "Invalid credentials");
        }

        if (!passwordResetPageUrl.isBlank()) {
            model.addAttribute("passwordResetUrl", passwordResetPageUrl);
        }

        if (!recaptchaSessionSiteKey.isBlank()) {
            model.addAttribute("recaptchaSessionSiteKey", recaptchaSessionSiteKey);
        } else if (!passwordResetPageUrl.isBlank() && !recaptchaSiteKey.isBlank()) {
            model.addAttribute("recaptchaSiteKey", recaptchaSiteKey);
        }

        return "login";
    }

    @GetMapping("/")
    public String index(Model model) {
        model.addAttribute("message", "OpenFrame Multi-Tenant Authorization");
        return "index";
    }
} 