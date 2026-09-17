package com.openframe.api.datafetcher.rmm;

import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.DgsQuery;
import com.netflix.graphql.dgs.InputArgument;
import com.openframe.api.dto.CountedGenericConnection;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.rmm.software.SoftwareActionFilterInput;
import com.openframe.api.dto.rmm.software.SoftwareActionResponse;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.api.service.rmm.software.SoftwareActionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;

@DgsComponent
@ConditionalOnProperty(name = "openframe.rmm.software.enabled", havingValue = "true")
@RequiredArgsConstructor
@Slf4j
public class SoftwareActionDataFetcher {

    private final SoftwareActionService softwareActionService;

    @DgsQuery
    public SoftwareActionResponse softwareAction(@InputArgument String id) {
        return softwareActionService.findById(id).orElse(null);
    }

    @DgsQuery
    public CountedGenericConnection<GenericEdge<SoftwareActionResponse>> softwareActions(
            @InputArgument SoftwareActionFilterInput filter,
            @InputArgument Integer first, @InputArgument String after,
            @InputArgument Integer last, @InputArgument String before,
            @InputArgument String search, @InputArgument SortInput sort) {
        int page = PageCursors.decodePage(after != null ? after : before);
        Integer perPage = first != null ? first : last;
        return PageCursors.toConnection(softwareActionService.list(filter, search, sort, page, perPage));
    }
}
