package com.openframe.api.federation;

import com.openframe.api.dto.user.UserResponse;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class ApiFederationResolverTest {

    private final ApiFederationResolver resolver = new ApiFederationResolver();

    @Test
    void typeMapping_userResponse_userType() {
        // execution
        Map<Class<?>, String> mapping = resolver.typeMapping();

        // verifications
        assertThat(mapping).containsEntry(UserResponse.class, "User");
    }
}
