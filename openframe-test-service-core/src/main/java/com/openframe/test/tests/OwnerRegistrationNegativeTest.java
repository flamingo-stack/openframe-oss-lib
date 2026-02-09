package com.openframe.test.tests;

import com.openframe.test.api.RegistrationApi;
import com.openframe.test.data.db.collections.UsersCollection;
import com.openframe.test.data.dto.error.ErrorResponse;
import com.openframe.test.data.dto.user.AuthUser;
import com.openframe.test.data.dto.user.UserRegistrationRequest;
import com.openframe.test.data.generator.RegistrationGenerator;
import com.openframe.test.tests.base.UnauthorizedTest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

@Tag("oss")
@DisplayName("Owner User registration - negative")
public class OwnerRegistrationNegativeTest extends UnauthorizedTest {

    @Test
    @DisplayName("Check that user cannot register when Registration is Closed")
    public void testRegistrationClosed() {
        AuthUser existingUser = UsersCollection.findUser();
        assertThat(existingUser).as("No Existing user found in DB").isNotNull();
        UserRegistrationRequest user = RegistrationGenerator.existingUserRequest(existingUser);
        ErrorResponse expectedResponse = RegistrationGenerator.registrationClosedResponse();
        ErrorResponse response = RegistrationApi.attemptRegistration(user);
        assertThat(response).isEqualTo(expectedResponse);
    }

    @Test
    @DisplayName("Check that user cannot register with Already Registered email")
    public void testRegisterExistingUser() {
        AuthUser existingUser = UsersCollection.findUser();
        assertThat(existingUser).as("No Existing user found in DB").isNotNull();
        UserRegistrationRequest user = RegistrationGenerator.existingUserRequest(existingUser);
        ErrorResponse expectedResponse = RegistrationGenerator.existingUserResponse();
        ErrorResponse response = RegistrationApi.attemptRegistration(user);
        assertThat(response).isEqualTo(expectedResponse);
    }
}
