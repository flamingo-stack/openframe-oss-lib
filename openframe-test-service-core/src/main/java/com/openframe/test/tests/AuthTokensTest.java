package com.openframe.test.tests;

import com.openframe.test.api.AuthApi;
import com.openframe.test.api.AuthFlow;
import com.openframe.test.api.UserApi;
import com.openframe.test.config.UserConfig;
import com.openframe.test.data.db.collections.TenantsCollection;
import com.openframe.test.data.dto.tenant.Tenant;
import com.openframe.test.data.dto.user.MeResponse;
import com.openframe.test.data.dto.user.User;
import com.openframe.test.data.generator.AuthGenerator;
import com.openframe.test.helpers.AuthHelper;
import com.openframe.test.tests.base.UnauthorizedTest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

@Tag("oss")
@DisplayName("Test Access tokens")
public class AuthTokensTest extends UnauthorizedTest {

    @Tag("monitor")
    @Test
    @DisplayName("Verify refresh of access tokens")
    public void testRefreshTokens() {
        User user = UserConfig.getUser();
        Tenant tenant = TenantsCollection.findTenantByDomain(user.getDomain());
        Map<String, String> oldCookies = AuthFlow.login(user);
        Map<String, String> newCookies = AuthApi.refresh(tenant, oldCookies);
        assertThat(newCookies).isNotEqualTo(oldCookies);
        AuthHelper.setCookies(newCookies);
        MeResponse response = UserApi.me();
        assertThat(response.isAuthenticated()).isTrue();
    }

    @Test
    @DisplayName("Verify refresh of access tokens without tenantId")
    public void testRefreshTokensWithoutTenantId() {
        User user = UserConfig.getUser();
        Map<String, String> oldCookies = AuthFlow.login(user);
        Map<String, String> newCookies = AuthApi.refresh(oldCookies);
        assertThat(newCookies).isNotEqualTo(oldCookies);
        AuthHelper.setCookies(newCookies);
        MeResponse response = UserApi.me();
        assertThat(response.isAuthenticated()).isTrue();
    }

    @Test
    @DisplayName("Verify logout")
    public void testLogout() {
        User user = UserConfig.getUser();
        Tenant tenant = TenantsCollection.findTenantByDomain(user.getDomain());
        Map<String, String> oldCookies = AuthFlow.login(user);
        Map<String, String> newCookies = AuthApi.logout(tenant, oldCookies);
        assertThat(newCookies).isEqualTo(AuthGenerator.clearedCookies());
//      500 returned instead of 401 - needs fix
//        Response response = attemptRefresh(user, oldCookies);
//        assertThat(response.getStatusCode()).isEqualTo(401);
    }

    @Test
    @DisplayName("Verify logout without tenantId")
    public void testLogoutWithoutTenantId() {
        User user = UserConfig.getUser();
        Map<String, String> oldCookies = AuthFlow.login(user);
        Map<String, String> newCookies = AuthApi.logout(oldCookies);
        assertThat(newCookies).isEqualTo(AuthGenerator.clearedCookies());
//      500 returned instead of 401 - needs fix
//        Response response = attemptRefresh(user, oldCookies);
//        assertThat(response.getStatusCode()).isEqualTo(401);
    }
}

