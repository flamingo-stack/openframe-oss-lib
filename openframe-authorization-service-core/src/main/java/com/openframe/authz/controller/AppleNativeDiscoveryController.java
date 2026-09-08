package com.openframe.authz.controller;

import com.openframe.authz.dto.TenantRegistrationRequest;
import com.openframe.authz.service.sso.SsoAlreadyLinkedException;
import com.openframe.authz.service.sso.SsoIdentityService;
import com.openframe.authz.service.sso.apple.AppleNativeTokenVerifier;
import com.openframe.authz.service.tenant.TenantRegistrationService;
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

import java.util.UUID;

import static com.openframe.authz.config.oidc.AppleSSOProperties.APPLE;
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
    private final TenantRegistrationService registrationService;
    private final SsoIdentityService ssoIdentityService;

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

        // Link-first: the Apple sub survives email changes and Hide My Email relay churn.
        AuthUser user = ssoIdentityService.findLink(APPLE, token.getClaims())
                .flatMap(link -> userService.findActiveById(link.getUserId()))
                .or(() -> userService.findActiveByEmail(email.toLowerCase(ROOT)))
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "registration_required"));

        tenantService.findById(user.getTenantId())
                .filter(Tenant::isActive)
                .orElseThrow(() -> new ResponseStatusException(FORBIDDEN, "account_inactive"));

        return new AppleNativeDiscoverResponse(user.getTenantId());
    }

    public record AppleNativeRegisterRequest(String identityToken,
                                             String nonce,
                                             String tenantName,
                                             String tenantDomain,
                                             String firstName,
                                             String lastName) {}

    /**
     * Fully native signup: creates the tenant for a verified Apple identity that discovery
     * answered {@code registration_required} for. Deliberately does NOT redeem the Apple
     * authorization code — the code is single-use, and the BFF spends it immediately afterwards
     * on the regular native exchange against the new tenant, which is where replay protection
     * lives. Identity (email, verified flag) comes from the verified token; the client supplies
     * only what Apple cannot: org name, domain, and the names Apple hands the app natively.
     */
    @PostMapping("/register")
    public AppleNativeDiscoverResponse register(@RequestBody AppleNativeRegisterRequest body) {
        if (!hasText(body.identityToken()) || !hasText(body.tenantName()) || !hasText(body.tenantDomain())) {
            throw new ResponseStatusException(BAD_REQUEST, "identityToken, tenantName and tenantDomain are required");
        }
        Jwt token;
        try {
            token = tokenVerifier.verify(body.identityToken(), body.nonce());
        } catch (Exception e) {
            log.warn("event=apple-native-register-invalid-token msg={}", e.getMessage());
            throw new ResponseStatusException(UNAUTHORIZED, "Invalid Apple identity token");
        }
        String email = token.getClaimAsString("email");
        if (!hasText(email)) {
            throw new ResponseStatusException(UNAUTHORIZED, "Apple identity token carries no email");
        }
        try {
            ssoIdentityService.ensureNotAlreadyLinked(APPLE, token.getClaims());
        } catch (SsoAlreadyLinkedException e) {
            throw new ResponseStatusException(CONFLICT, "already_linked");
        }
        if (userService.findActiveByEmail(email.toLowerCase(ROOT)).isPresent()) {
            throw new ResponseStatusException(CONFLICT, "account_exists");
        }

        TenantRegistrationRequest reg = TenantRegistrationRequest.builder()
                .email(email.toLowerCase(ROOT))
                .firstName(hasText(body.firstName()) ? body.firstName() : "")
                .lastName(hasText(body.lastName()) ? body.lastName() : "")
                .password(UUID.randomUUID().toString())
                .tenantName(body.tenantName())
                .tenantDomain(body.tenantDomain().toLowerCase(ROOT))
                .emailPreVerified(OidcUserUtils.emailVerifiedClaimAllows(token.getClaims()))
                .build();

        Tenant tenant = registrationService.registerTenant(reg);
        log.info("event=apple-native-register tenant={}", tenant.getId());
        return new AppleNativeDiscoverResponse(tenant.getId());
    }
}
