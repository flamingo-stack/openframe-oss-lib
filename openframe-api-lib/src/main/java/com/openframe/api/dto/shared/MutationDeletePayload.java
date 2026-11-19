package com.openframe.api.dto.shared;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MutationDeletePayload {
    private String deletedId;
    @Builder.Default
    private List<MutationError> userErrors = List.of();

    public static MutationDeletePayload success(String deletedId) {
        return MutationDeletePayload.builder()
                .deletedId(deletedId)
                .build();
    }

    public static MutationDeletePayload error(String message) {
        return MutationDeletePayload.builder()
                .userErrors(List.of(MutationError.builder().message(message).build()))
                .build();
    }
}
