package com.openframe.test.tests;

import com.openframe.test.api.UserApi;
import com.openframe.test.config.UserConfig;
import com.openframe.test.data.dto.error.ErrorResponse;
import com.openframe.test.data.dto.user.MeResponse;
import com.openframe.test.data.dto.user.ResetConfirmRequest;
import com.openframe.test.data.dto.user.User;
import com.openframe.test.data.generator.AuthGenerator;
import com.openframe.test.data.redis.Redis;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

@Tag("reset")
@DisplayName("Reset Password")
public class ResetPasswordTest {

    @Test
    @DisplayName("Verify that user can reset password")
    public void testResetPassword() {
        User user = UserConfig.getUser();
        UserApi.resetPassword(user);
        String token = Redis.getResetToken(user.getEmail());
        assertThat(token).as("Reset token should not be null").isNotNull();
        ResetConfirmRequest confirmRequest = AuthGenerator.resetConfirmRequest(token);
        UserApi.confirmReset(confirmRequest);
        user.setPassword(confirmRequest.getNewPassword());
        MeResponse me = UserApi.me();
        assertThat(me.isAuthenticated()).as("User should be authenticated after password reset").isTrue();
    }

    @Test
    @DisplayName("Verify that user cannot reset password with invalid token")
    public void testResetPasswordWithInvalidToken() {
        String token = "invalid";
        ResetConfirmRequest confirmRequest = AuthGenerator.resetConfirmRequest(token);
        ErrorResponse response = UserApi.attemptConfirmReset(confirmRequest);
        assertThat(response).as("Response should match invalid token error").isEqualTo(AuthGenerator.invalidTokenResponse());
    }
}
