package com.openframe.test.data.generator;

import com.openframe.test.data.dto.error.ErrorResponse;
import com.openframe.test.data.dto.user.AuthUser;
import com.openframe.test.data.dto.user.UserRegistrationRequest;
import com.openframe.test.data.dto.user.UserRegistrationResponse;
import net.datafaker.Faker;

import java.time.LocalTime;

import static com.openframe.test.config.UserConfig.*;


public class RegistrationGenerator {

    private static final String FIRST_NAME = "Auto";
    private static final String LAST_NAME = "Tester";

    private static final Faker faker = new Faker();
    private static final String regexTemplate = "[^a-zA-Z0-9]";

    public static UserRegistrationRequest newUserRegistrationRequest() {
        return UserRegistrationRequest.builder()
                .email(getEmail())
                .firstName(FIRST_NAME)
                .lastName(LAST_NAME)
                .password(getPassword())
                .tenantName(faker.company().name().replaceAll(regexTemplate, ""))
                .tenantDomain(getDomain())
                .build();
    }

    public static UserRegistrationRequest userRegistrationRequest() {
        return UserRegistrationRequest.builder()
                .email(faker.internet().emailAddress())
                .firstName(faker.name().firstName())
                .lastName(faker.name().lastName())
                .password(getPassword())
                .tenantName(faker.company().name().replaceAll(regexTemplate, ""))
                .tenantDomain(getDomain())
                .build();
    }

    public static UserRegistrationRequest existingUserRequest(AuthUser existingUser) {
        return UserRegistrationRequest.builder()
                .email(existingUser.getEmail())
                .firstName(existingUser.getFirstName())
                .lastName(existingUser.getLastName())
                .password(getPassword())
                .tenantName(faker.company().name().replaceAll(regexTemplate, ""))
                .tenantDomain(getDomain())
                .build();
    }

    public static UserRegistrationResponse newUserRegistrationResponse(UserRegistrationRequest user) {
        return UserRegistrationResponse.builder()
                .name(user.getTenantName())
                .domain(user.getTenantDomain())
                .status("ACTIVE")
                .plan("FREE")
                .createdAt(LocalTime.now().toString())
                .updatedAt(LocalTime.now().toString())
                .active(true)
                .build();
    }

    public static ErrorResponse registrationClosedResponse() {
        return ErrorResponse.builder().code("BAD_REQUEST").message("Registration is closed for this organization").build();
    }

    public static ErrorResponse existingUserResponse() {
        return ErrorResponse.builder().code("BAD_REQUEST").message("Registration is closed for this organization").build();
    }

}
