package com.openframe.test.data.generator;

import com.openframe.test.data.dto.user.UpdateUserRequest;
import net.datafaker.Faker;

public class UserGenerator {

    private static final Faker faker = new Faker();

    public static UpdateUserRequest updateUserRequest() {
        return UpdateUserRequest.builder()
                .firstName(faker.name().firstName())
                .lastName(faker.name().lastName())
                .build();
    }

    /** Only the first name, {@code length} characters long; the last name is omitted and so left unchanged. */
    public static UpdateUserRequest updateFirstNameRequest(int length) {
        return UpdateUserRequest.builder()
                .firstName(faker.lorem().characters(length, false, false))
                .build();
    }
}
