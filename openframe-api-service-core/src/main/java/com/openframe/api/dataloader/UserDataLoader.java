package com.openframe.api.dataloader;

import com.netflix.graphql.dgs.DgsDataLoader;
import com.openframe.api.dto.user.UserResponse;
import com.openframe.api.service.user.UserService;
import lombok.RequiredArgsConstructor;
import org.dataloader.BatchLoader;

import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.stream.Collectors;

/**
 * DataLoader for batch loading UserResponse objects by id.
 * Used by KnowledgeBaseItem.author field resolver.
 * Goes through UserService so registered UserProcessor (e.g. SaaS impl)
 * enriches each UserResponse with image data.
 */
@DgsDataLoader(name = "userDataLoader")
@RequiredArgsConstructor
public class UserDataLoader implements BatchLoader<String, UserResponse> {

    private final UserService userService;

    @Override
    public CompletionStage<List<UserResponse>> load(List<String> userIds) {
        return CompletableFuture.supplyAsync(() -> {
            Set<String> nonNullIds = userIds.stream()
                    .filter(Objects::nonNull)
                    .collect(Collectors.toSet());

            if (nonNullIds.isEmpty()) {
                return userIds.stream()
                        .map(id -> (UserResponse) null)
                        .collect(Collectors.toList());
            }

            Map<String, UserResponse> userMap = userService.getUsersByIds(nonNullIds).stream()
                    .collect(Collectors.toMap(UserResponse::getId, u -> u));

            return userIds.stream()
                    .map(id -> id == null ? null : userMap.get(id))
                    .collect(Collectors.toList());
        });
    }
}
