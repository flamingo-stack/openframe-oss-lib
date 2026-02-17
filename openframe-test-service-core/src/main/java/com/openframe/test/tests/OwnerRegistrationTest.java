package com.openframe.test.tests;

import com.openframe.test.api.OrganizationApi;
import com.openframe.test.api.RegistrationApi;
import com.openframe.test.api.UserApi;
import com.openframe.test.api.auth.AuthFlow;
import com.openframe.test.config.UserConfig;
import com.openframe.test.data.dto.organization.Organization;
import com.openframe.test.data.dto.user.MeResponse;
import com.openframe.test.data.dto.user.UserRegistrationRequest;
import com.openframe.test.data.dto.user.UserRegistrationResponse;
import com.openframe.test.data.generator.RegistrationGenerator;
import com.openframe.test.helpers.AuthHelper;
import org.junit.jupiter.api.*;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

// This test class will be executed before all other tests

@Tag("registration")
@DisplayName("Owner registration")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class OwnerRegistrationTest {

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

    @Tag("login")
    @Order(2)
    @Test
    @DisplayName("Login Owner user")
    public void testLoginNewUser() {
        Map<String, String> cookies = AuthFlow.login(UserConfig.getUser());
        AuthHelper.setCookies(cookies);
        MeResponse response = UserApi.me();
        assertThat(response.isAuthenticated()).as("Could not login").isTrue();
    }

    @Order(3)
    @Test
    @DisplayName("Check that default organization is created")
    public void testDefaultOrganizationCreated() {
        List<Organization> organizations = OrganizationApi.getOrganizations(true);
        assertThat(organizations).as("No Default organization created").isNotEmpty();
    }
}
