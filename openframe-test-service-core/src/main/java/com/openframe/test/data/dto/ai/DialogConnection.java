package com.openframe.test.data.dto.ai;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.openframe.test.data.dto.shared.PageInfo;
import com.openframe.test.helpers.RelayIds;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/** Page of {@code dialogs(...)} on {@code chat/graphql}. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class DialogConnection {
    private List<DialogEdge> edges;
    private PageInfo pageInfo;

    public List<DialogResponse> nodes() {
        return edges == null ? List.of() : edges.stream().map(DialogEdge::getNode).toList();
    }

    /**
     * The nodes' ids as raw ids, for comparing with a dialogId from REST. The GraphQL {@code id} is a Relay
     * global id once the chat API has migrated and a raw id before, so it is normalised here and never sent back.
     */
    public List<String> rawIds() {
        return nodes().stream().map(DialogResponse::getId).map(RelayIds::raw).toList();
    }
}
