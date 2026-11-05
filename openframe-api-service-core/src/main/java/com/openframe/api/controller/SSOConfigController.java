package com.openframe.api.controller;

import com.openframe.api.dto.SSOConfigRequest;
import com.openframe.api.dto.SSOConfigResponse;
import com.openframe.api.dto.SSOConfigStatusResponse;
import com.openframe.api.dto.SSOProviderInfo;
import com.openframe.api.service.SSOConfigService;
import com.openframe.audit.AuditCapture;
import com.openframe.audit.Audited;
import com.openframe.data.document.audit.AuditAction;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

import static com.openframe.api.service.SSOConfigService.isOpenframeLogin;
import static com.openframe.data.document.audit.AuditAction.AUTH_PASSWORD_LOGIN_TOGGLE;
import static com.openframe.data.document.audit.AuditAction.SSO_CONFIG_DELETE;
import static com.openframe.data.document.audit.AuditAction.SSO_CONFIG_SECRET_VIEW;
import static com.openframe.data.document.audit.AuditAction.SSO_CONFIG_SET;
import static com.openframe.data.document.audit.AuditAction.SSO_CONFIG_TOGGLE;
import static com.openframe.data.document.sso.SSOConfig.OPENFRAME_PROVIDER;
import static org.springframework.http.HttpStatus.*;

@RestController
@RequestMapping("/sso")
@RequiredArgsConstructor
public class SSOConfigController {
    private final SSOConfigService ssoConfigService;
    private final AuditCapture auditCapture;

    /**
     * Get list of enabled SSO providers - used by login components
     * Returns list of configured and enabled providers with their client IDs
     */
    @GetMapping("/providers")
    @ResponseStatus(OK)
    public List<SSOConfigStatusResponse> getEnabledProviders() {
        return ssoConfigService.getEnabledProviders();
    }

    /**
     * Get list of available SSO providers - used by admin dropdowns
     * Returns all providers that have strategy implementations
     */
    @GetMapping("/providers/available")
    @ResponseStatus(OK)
    public List<SSOProviderInfo> getAvailableProviders() {
        return ssoConfigService.getAvailableProviders();
    }

    /**
     * Get full SSO configuration for admin forms
     */
    @GetMapping("/{provider}")
    @ResponseStatus(OK)
    @Audited(action = SSO_CONFIG_SECRET_VIEW, targetId = "#provider", condition = "#result.clientSecret != null")
    public SSOConfigResponse getConfig(@PathVariable String provider) {
        return ssoConfigService.getConfig(provider);
    }

    @PostMapping("/{provider}")
    @ResponseStatus(CREATED)
    @Audited(action = SSO_CONFIG_SET, targetId = "#provider")
    public SSOConfigResponse saveConfig(@PathVariable String provider, @Valid @RequestBody SSOConfigRequest request) {
        return ssoConfigService.upsertConfig(provider, request);
    }

    @PutMapping("/{provider}")
    @ResponseStatus(OK)
    @Audited(action = SSO_CONFIG_SET, targetId = "#provider")
    public SSOConfigResponse updateConfig(@PathVariable String provider, @Valid @RequestBody SSOConfigRequest request) {
        return ssoConfigService.upsertConfig(provider, request);
    }

    @PatchMapping("/{provider}/toggle")
    @ResponseStatus(NO_CONTENT)
    public void toggleEnabled(@PathVariable String provider, @RequestParam boolean enabled) {
        boolean passwordLogin = isOpenframeLogin(provider);
        AuditAction action = passwordLogin ? AUTH_PASSWORD_LOGIN_TOGGLE : SSO_CONFIG_TOGGLE;
        auditCapture.run(action, passwordLogin ? OPENFRAME_PROVIDER : provider, Map.of("enabled", enabled),
                () -> ssoConfigService.toggleEnabled(provider, enabled));
    }

    @DeleteMapping("/{provider}")
    @ResponseStatus(NO_CONTENT)
    public void deleteConfig(@PathVariable String provider) {
        boolean passwordLogin = isOpenframeLogin(provider);
        AuditAction action = passwordLogin ? AUTH_PASSWORD_LOGIN_TOGGLE : SSO_CONFIG_DELETE;
        Map<String, Object> details = passwordLogin ? Map.of("enabled", true) : Map.of();
        auditCapture.run(action, passwordLogin ? OPENFRAME_PROVIDER : provider, details,
                () -> ssoConfigService.deleteConfig(provider));
    }
}