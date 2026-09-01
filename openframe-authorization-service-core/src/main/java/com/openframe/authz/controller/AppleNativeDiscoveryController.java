package com.openframe.authz.controller;

import com.openframe.authz.service.sso.apple.AppleNativeTokenVerifier;
import com.openframe.authz.service.tenant.TenantService;
import com.openframe.authz.service.user.UserService;
import com.openframe.authz.util.OidcUserUtils;
import com.openframe.data.document.auth.AuthUser;
import com.openframe.data.document.tenant.Tenant;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import static java.util.Locale.ROOT;
import static org.springframework.http.HttpStatus.*;
import static org.springframework.util.StringUtils.hasText;

/**
 * Tenant discovery for the native Sign in with Apple exchange. The mobile app authenticates with
 * Apple natively but doesn't know which tenant the user belongs to — and with Hide My Email it
 * can't even ask the user, who doesn't know their own relay address. This endpoint resolves the
 * tenant from the VERIFIED identity token, so only a holder of a genuine, fresh Apple token for
 * one of our native client ids can query — no email enumeration surface.
 * <p>
 * Apple has no per-tenant custom apps (generic-only provider), so unlike the web email-less login
 * there is no forbidden-provider case here.
 */
@Slf4j
@RestController
@RequestMapping(path = "/oauth/apple/native", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
public class AppleNativeDiscoveryController {

    private final AppleNativeTokenVerifier tokenVerifier;
    private final UserService userService;
    private final TenantService tenantService;

    public record AppleNativeDiscoverRequest(String identityToken, String nonce) {}

    public record AppleNativeDiscoverResponse(String tenantId) {}

    @PostMapping("/discover")
    public AppleNativeDiscoverResponse discover(@RequestBody AppleNativeDiscoverRequest body) {
        if (!hasText(body.identityToken())) {
            throw new ResponseStatusException(BAD_REQUEST, "identityToken is required");
        }
        Jwt token;
        try {
            token = tokenVerifier.verify(body.identityToken(), body.nonce());
        } catch (Exception e) {
            log.warn("event=apple-native-discover-invalid-token msg={}", e.getMessage());
            throw new ResponseStatusException(UNAUTHORIZED, "Invalid Apple identity token");
        }
        String email = token.getClaimAsString("email");
        if (!hasText(email) || !OidcUserUtils.emailVerifiedClaimAllows(token.getClaims())) {
            throw new ResponseStatusException(UNAUTHORIZED, "Apple identity token carries no verified email");
        }

        AuthUser user = userService.findActiveByEmail(email.toLowerCase(ROOT))
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "registration_required"));

        tenantService.findById(user.getTenantId())
                .filter(Tenant::isActive)
                .orElseThrow(() -> new ResponseStatusException(FORBIDDEN, "account_inactive"));

        return new AppleNativeDiscoverResponse(user.getTenantId());
    }
}
