package com.openframe.test.data.dto.ai;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.openframe.test.data.dto.shared.PageInfo;
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

    public List<String> ids() {
        return nodes().stream().map(DialogResponse::getId).toList();
    }
}
