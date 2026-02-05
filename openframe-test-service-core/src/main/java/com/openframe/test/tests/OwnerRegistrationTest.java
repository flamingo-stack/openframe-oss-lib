package com.openframe.test.tests;

import com.openframe.test.api.AuthFlow;
import com.openframe.test.api.OrganizationApi;
import com.openframe.test.api.RegistrationApi;
import com.openframe.test.api.UserApi;
import com.openframe.test.config.UserConfig;
import com.openframe.test.data.dto.user.MeResponse;
import com.openframe.test.data.dto.user.UserRegistrationRequest;
import com.openframe.test.data.dto.user.UserRegistrationResponse;
import com.openframe.test.data.generator.RegistrationGenerator;
import com.openframe.test.helpers.AuthHelper;
import com.openframe.test.tests.base.UnauthorizedTest;
import org.junit.jupiter.api.*;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

// This test class will be executed before all other tests

@Tag("registration")
@DisplayName("Owner registration")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class OwnerRegistrationTest extends UnauthorizedTest {

    @Order(1)
    @Test
    @DisplayName("Register Owner user")
    public void testRegisterNewUser() {
        UserRegistrationRequest userRegistrationRequest = RegistrationGenerator.newUserRegistrationRequest();
        UserRegistrationResponse expectedResponse = RegistrationGenerator.newUserRegistrationResponse(userRegistrationRequest);
        UserRegistrationResponse response = RegistrationApi.registerUser(userRegistrationRequest);
        assertThat(response.getId()).isNotNull();
        assertThat(response.getOwnerId()).isNotNull();
        assertThat(response.getCreatedAt()).isNotNull();
        assertThat(response.getUpdatedAt()).isNotNull();
        assertThat(response).usingRecursiveComparison()
                .ignoringFields("id", "ownerId", "hubspotId", "createdAt", "updatedAt")
                .isEqualTo(expectedResponse);
    }

    @Order(2)
    @Test
    @DisplayName("Login Owner user")
    public void testLoginNewUser() {
        AuthHelper.setCookies(AuthFlow.login(UserConfig.getUser()));
        MeResponse response = UserApi.me();
        assertThat(response.isAuthenticated()).isTrue();
    }

    @Order(3)
    @Test
    @DisplayName("Check that default organization is created")
    public void testDefaultOrganizationCreated() {
        List<String> orgNames = OrganizationApi.getOrganizationNames();
        assertThat(orgNames).hasSize(1);
        assertThat(orgNames.getFirst()).isEqualTo("Default");
    }
}
