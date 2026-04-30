package com.openframe.api.dataloader;

import com.netflix.graphql.dgs.DgsDataLoader;
import com.openframe.data.document.user.User;
import com.openframe.data.repository.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.dataloader.BatchLoader;

import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.stream.Collectors;

/**
 * DataLoader for batch loading User objects by id.
 * Used by KnowledgeBaseItem.author field resolver.
 */
@DgsDataLoader(name = "userDataLoader")
@RequiredArgsConstructor
public class UserDataLoader implements BatchLoader<String, User> {

    private final UserRepository userRepository;

    @Override
    public CompletionStage<List<User>> load(List<String> userIds) {
        return CompletableFuture.supplyAsync(() -> {
            Set<String> nonNullIds = userIds.stream()
                    .filter(Objects::nonNull)
                    .collect(Collectors.toSet());

            if (nonNullIds.isEmpty()) {
                return userIds.stream()
                        .map(id -> (User) null)
                        .collect(Collectors.toList());
            }

            List<User> users = userRepository.findAllById(nonNullIds);
            Map<String, User> userMap = users.stream()
                    .collect(Collectors.toMap(User::getId, u -> u));

            return userIds.stream()
                    .map(id -> id == null ? null : userMap.get(id))
                    .collect(Collectors.toList());
        });
    }
}
