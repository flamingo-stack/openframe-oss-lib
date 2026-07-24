package com.openframe.test.tests;

import com.openframe.test.api.RegistrationApi;
import com.openframe.test.api.UserApi;
import com.openframe.test.data.dto.user.AuthUser;
import com.openframe.test.data.dto.user.UserRegistrationRequest;
import com.openframe.test.data.dto.user.UserRole;
import com.openframe.test.data.generator.RegistrationGenerator;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@Tag("oss")
@Tag("registration-negative")
@DisplayName("Owner User registration - negative")
public class OwnerRegistrationNegativeTest extends BaseTest {

    @Test
    @DisplayName("Check that user cannot register when Registration is Closed")
    public void testRegistrationClosed() {
        UserRegistrationRequest userRegistrationRequest = RegistrationGenerator.userRegistrationRequest();
        int statusCode = RegistrationApi.attemptRegistration(userRegistrationRequest);
        assertThat(statusCode).as("Registration should be rejected with a client/server error").isGreaterThanOrEqualTo(400);
    }

    @Test
    @DisplayName("Check that user cannot register with Already Registered email")
    public void testRegisterExistingUser() {
        List<AuthUser> users = UserApi.getUsers(UserRole.OWNER);
        assertThat(users).as("No existing user").isNotEmpty();
        UserRegistrationRequest userRegistrationRequest = RegistrationGenerator.existingUserRequest(users.getLast());
        int statusCode = RegistrationApi.attemptRegistration(userRegistrationRequest);
        assertThat(statusCode).as("Registration should be rejected with a client/server error").isGreaterThanOrEqualTo(400);
    }
}
