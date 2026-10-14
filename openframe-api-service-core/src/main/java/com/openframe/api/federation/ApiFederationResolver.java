package com.openframe.api.federation;

import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.federation.DefaultDgsFederationResolver;
import com.openframe.api.dto.user.UserResponse;

import java.util.Map;

@DgsComponent
public class ApiFederationResolver extends DefaultDgsFederationResolver {

    private static final Map<Class<?>, String> TYPE_MAPPING = Map.of(UserResponse.class, "User");

    @Override
    public Map<Class<?>, String> typeMapping() {
        return TYPE_MAPPING;
    }
}
