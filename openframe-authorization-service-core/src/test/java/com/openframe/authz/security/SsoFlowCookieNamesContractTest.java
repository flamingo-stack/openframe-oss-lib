package com.openframe.authz.security;

import com.openframe.authz.security.flow.InviteSsoHandler;
import com.openframe.authz.security.flow.LoginSsoHandler;
import com.openframe.authz.security.flow.SsoFlowHandler;
import com.openframe.authz.security.flow.TenantRegSsoHandler;
import com.openframe.core.constants.SsoFlowCookieNames;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * A flow cookie name that exists in only one place recreates the stale-cookie hijack: the resolver
 * would inject a leftover cookie's state into the next login. Every handler's cookie must be in
 * {@link SsoFlowCookieNames#ALL}, and {@code ALL} must hold nothing without a handler.
 */
class SsoFlowCookieNamesContractTest {

    private static final List<SsoFlowHandler> HANDLERS = List.of(
            new TenantRegSsoHandler(null, null, null),
            new InviteSsoHandler(null, null, null),
            new LoginSsoHandler(null, null, null, null, null, null, null, null, null));

    @Test
    void shouldListExactlyTheCookiesOfTheFlowHandlers() {
        assertThat(HANDLERS).extracting(SsoFlowHandler::cookieName)
                .containsExactlyInAnyOrderElementsOf(SsoFlowCookieNames.ALL);
    }

    @Test
    void shouldHaveNoDuplicateNames() {
        assertThat(SsoFlowCookieNames.ALL).doesNotHaveDuplicates();
    }
}
