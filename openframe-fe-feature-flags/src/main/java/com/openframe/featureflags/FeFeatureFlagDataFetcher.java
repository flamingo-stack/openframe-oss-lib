package com.openframe.featureflags;

import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.DgsQuery;
import com.netflix.graphql.dgs.InputArgument;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import java.util.Collection;
import java.util.List;
import java.util.Map;

@Slf4j
@DgsComponent
@RequiredArgsConstructor
public class FeFeatureFlagDataFetcher {

    private final FeFeatureFlagProperties properties;

    @DgsQuery
    public List<FeFeatureFlag> feFeatureFlags(@InputArgument List<String> names) {
        Map<String, Boolean> flags = properties.getFeFeatureFlag();

        Collection<String> keys = (names == null || names.isEmpty())
                ? flags.keySet()
                : names;

        return keys.stream()
                .map(name -> FeFeatureFlag.builder()
                        .name(name)
                        .enabled(flags.getOrDefault(name, false))
                        .build())
                .toList();
    }
}
