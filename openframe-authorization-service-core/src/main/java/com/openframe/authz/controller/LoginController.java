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

    @GetMapping("/login")
    public String login(Model model,
                        @RequestParam(value = "error", required = false) String error) {

        if (error != null) {
            model.addAttribute("errorMessage", "Invalid credentials");
        }

        if (!passwordResetPageUrl.isBlank()) {
            model.addAttribute("passwordResetUrl", passwordResetPageUrl);
        }

        return "login";
    }

    @GetMapping("/")
    public String index(Model model) {
        model.addAttribute("message", "OpenFrame Multi-Tenant Authorization");
        return "index";
    }
} 