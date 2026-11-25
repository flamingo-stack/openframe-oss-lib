package com.openframe.api.controller;

import com.openframe.api.dto.SSOConfigRequest;
import com.openframe.api.dto.SSOConfigResponse;
import com.openframe.api.dto.SSOConfigStatusResponse;
import com.openframe.api.dto.SSOProviderInfo;
import com.openframe.api.service.SSOConfigService;
import com.openframe.audit.AuditCall;
import com.openframe.audit.Audited;
import com.openframe.audit.AuditedMethodRunner;
import com.openframe.data.document.audit.AuditAction;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
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
    private final AuditedMethodRunner auditedMethodRunner;

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
    public SSOConfigResponse saveConfig(@PathVariable String provider, @Valid @RequestBody SSOConfigRequest request) {
        return setConfig(provider, request);
    }

    @PutMapping("/{provider}")
    @ResponseStatus(OK)
    public SSOConfigResponse updateConfig(@PathVariable String provider, @Valid @RequestBody SSOConfigRequest request) {
        return setConfig(provider, request);
    }

    private SSOConfigResponse setConfig(String provider, SSOConfigRequest request) {
        boolean isNew = auditedMethodRunner.isEnabled() && ssoConfigService.isNewConfig(provider);
        AuditCall auditCall = AuditCall.of(SSO_CONFIG_SET, provider)
                .withTargetNameOf(_ -> provider)
                .withDetailsFromResult(result -> detailsOfSet(request, result, isNew));
        return auditedMethodRunner.run(auditCall, () -> ssoConfigService.upsertConfig(provider, request));
    }

    private static Map<String, Object> detailsOfSet(SSOConfigRequest request, Object result, boolean isNew) {
        if (!(result instanceof SSOConfigResponse saved)) {
            return settingsOf(request.getClientId(), request.getMsTenantId(), request.getAutoProvisionUsers(),
                    request.getAllowedDomains(), null);
        }
        if (!isNew) {
            return Map.of();
        }
        return settingsOf(saved.getClientId(), saved.getMsTenantId(), saved.isAutoProvisionUsers(),
                saved.getAllowedDomains(), saved.isEnabled());
    }

    private static Map<String, Object> settingsOf(String clientId, String msTenantId, Boolean autoProvisionUsers,
                                                  List<String> allowedDomains, Boolean enabled) {
        Map<String, Object> settings = new HashMap<>();
        settings.put("clientId", clientId);
        settings.put("msTenantId", msTenantId);
        settings.put("autoProvisionUsers", autoProvisionUsers);
        settings.put("allowedDomains", allowedDomains);
        settings.put("enabled", enabled);
        return settings;
    }

    @PatchMapping("/{provider}/toggle")
    @ResponseStatus(NO_CONTENT)
    public void toggleEnabled(@PathVariable String provider, @RequestParam boolean enabled) {
        boolean passwordLogin = isOpenframeLogin(provider);
        AuditAction action = passwordLogin ? AUTH_PASSWORD_LOGIN_TOGGLE : SSO_CONFIG_TOGGLE;
        String targetId = passwordLogin ? OPENFRAME_PROVIDER : provider;
        auditedMethodRunner.runWhenChanged(action, action.getTargetType(), targetId, Map.of("enabled", enabled),
                () -> ssoConfigService.toggleEnabled(provider, enabled));
    }

    @DeleteMapping("/{provider}")
    @ResponseStatus(NO_CONTENT)
    public void deleteConfig(@PathVariable String provider) {
        boolean passwordLogin = isOpenframeLogin(provider);
        AuditAction action = passwordLogin ? AUTH_PASSWORD_LOGIN_TOGGLE : SSO_CONFIG_DELETE;
        Map<String, Object> details = passwordLogin ? Map.of("enabled", true) : Map.of();
        String targetId = passwordLogin ? OPENFRAME_PROVIDER : provider;
        AuditCall auditCall = AuditCall.of(action, action.getTargetType(), targetId, details)
                .withCompare(false)
                .withStoreIf(Boolean.TRUE::equals)
                .withTargetNameOf(_ -> targetId);
        auditedMethodRunner.run(auditCall, () -> ssoConfigService.deleteConfig(provider));
    }
}