package com.openframe.authz.controller;

import com.openframe.authz.service.sso.SSOConfigService;
import com.openframe.authz.service.validation.InvitationValidator;
import com.openframe.data.document.auth.AuthInvitation;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping(path = "/sso/providers", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
public class SsoDiscoveryController {

    private final InvitationValidator invitationValidator;
    private final SSOConfigService ssoConfigService;

    /**
     * Providers available for accepting an invitation.
     * Looks up tenant by invitation and returns effective providers for that tenant.
     */
    @GetMapping("/invite")
    public ProvidersResponse providersForInvitation(@RequestParam("invitationId") String invitationId) {
        AuthInvitation inv = invitationValidator.loadAndEnsureAcceptable(invitationId);
        List<String> providers = ssoConfigService.getEffectiveProvidersForTenant(inv.getTenantId());
        return new ProvidersResponse(providers);
    }

    /**
     * Providers available for onboarding/registration (no tenant yet).
     * Returns effective defaults configured at the system level.
     */
    @GetMapping("/registration")
    public ProvidersResponse providersForRegistration() {
        List<String> providers = ssoConfigService.getDefaultProviders();
        return new ProvidersResponse(providers);
    }

    public record ProvidersResponse(List<String> providers) {}
}

