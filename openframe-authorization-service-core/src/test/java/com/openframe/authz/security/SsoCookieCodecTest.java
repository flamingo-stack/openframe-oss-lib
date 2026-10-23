package com.openframe.authz.security;

import com.openframe.authz.dto.RegistrationAttribution;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

import static com.openframe.authz.support.SsoTestFixtures.cookieCodec;
import static com.openframe.authz.support.SsoTestFixtures.inTenMinutes;
import static com.openframe.authz.support.SsoTestFixtures.tenMinutesAgo;
import static org.assertj.core.api.Assertions.assertThat;

class SsoCookieCodecTest {

    private final SsoCookieCodec codec = cookieCodec();

    private static SsoLoginCookiePayload login(long exp) {
        return new SsoLoginCookiePayload("state-1", "google", "/dashboard", false, 1L, exp);
    }

    @Test
    void shouldRoundTripLoginPayload() {
        SsoLoginCookiePayload payload = login(inTenMinutes());

        assertThat(codec.decodeLogin(codec.encodeLogin(payload))).contains(payload);
    }

    @Test
    void shouldRoundTripInvitePayload() {
        SsoInviteCookiePayload payload = new SsoInviteCookiePayload(
                "state-2", "inv-1", true, "microsoft", "com.openframe.app://auth", true, 1L, inTenMinutes());

        assertThat(codec.decodeInvite(codec.encodeInvite(payload))).contains(payload);
    }

    @Test
    void shouldRoundTripTenantRegistrationPayloadWithAttribution() {
        RegistrationAttribution attribution = RegistrationAttribution.builder().utmSource("ads").gclid("g-1").build();
        SsoTenantRegCookiePayload payload = new SsoTenantRegCookiePayload(
                "state-3", "owner@acme.com", "Acme", "acme", "google", null, false, attribution, 1L, inTenMinutes());

        assertThat(codec.decodeTenant(codec.encodeTenant(payload))).contains(payload);
    }

    @Test
    void shouldRejectTokenWhoseBodyWasChangedButSignatureKept() {
        String token = codec.encodeLogin(login(inTenMinutes()));
        String signature = token.substring(token.indexOf('.') + 1);
        String forgedBody = Base64.getUrlEncoder().withoutPadding().encodeToString(
                "{\"s\":\"attacker-state\",\"provider\":\"google\",\"authMobile\":false,\"iat\":1,\"exp\":0}"
                        .getBytes(StandardCharsets.UTF_8));

        assertThat(codec.decodeLogin(forgedBody + "." + signature)).isEmpty();
    }

    @Test
    void shouldRejectTokenSignedWithAnotherSecret() {
        String foreign = cookieCodec("another-secret-another-secret-123").encodeLogin(login(inTenMinutes()));

        assertThat(codec.decodeLogin(foreign)).isEmpty();
        assertThat(codec.decodeState(foreign)).isEmpty();
    }

    @Test
    void shouldRejectExpiredToken() {
        String token = codec.encodeLogin(login(tenMinutesAgo()));

        assertThat(codec.decodeLogin(token)).isEmpty();
        assertThat(codec.decodeState(token)).isEmpty();
    }

    @Test
    void shouldTreatZeroExpiryAsNoExpiry() {
        String token = codec.encodeLogin(login(0L));

        assertThat(codec.decodeLogin(token)).isPresent();
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"no-dot-at-all", ".signature-only", "body-only.", "!!!not-base64!!!.sig", "e30.bad-signature"})
    void shouldReturnEmptyForMalformedTokensWithoutThrowing(String token) {
        assertThat(codec.decodeLogin(token)).isEmpty();
        assertThat(codec.decodeState(token)).isEmpty();
    }

    @Test
    void shouldReadStateFromEveryFlowPayloadType() {
        String loginToken = codec.encodeLogin(login(inTenMinutes()));
        String inviteToken = codec.encodeInvite(new SsoInviteCookiePayload(
                "invite-state", "inv-1", false, "google", null, false, 1L, inTenMinutes()));
        String regToken = codec.encodeTenant(new SsoTenantRegCookiePayload(
                "reg-state", "a@acme.com", "Acme", "acme", "google", null, false, null, 1L, inTenMinutes()));

        assertThat(codec.decodeState(loginToken)).contains("state-1");
        assertThat(codec.decodeState(inviteToken)).contains("invite-state");
        assertThat(codec.decodeState(regToken)).contains("reg-state");
    }

    @Test
    void shouldDecodeLoginCookieAsInviteWithoutInvitationId() {
        // Pinned: every flow cookie shares one secret, so a login cookie value decodes as an invite
        // payload with no invitation id. Callers must reject the missing id (InvitationValidator does).
        String loginToken = codec.encodeLogin(login(inTenMinutes()));

        assertThat(codec.decodeInvite(loginToken))
                .hasValueSatisfying(invite -> assertThat(invite.invitationId()).isNull());
    }

    @Test
    void shouldProduceUrlSafeTokenWithSingleSeparator() {
        String token = codec.encodeLogin(login(inTenMinutes()));

        assertThat(token).matches("^[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+$");
    }
}
