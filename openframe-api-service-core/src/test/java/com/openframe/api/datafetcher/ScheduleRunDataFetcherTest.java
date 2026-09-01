package com.openframe.api.datafetcher;

import com.netflix.graphql.dgs.DgsDataFetchingEnvironment;
import com.openframe.api.datafetcher.rmm.ScheduleRunDataFetcher;
import com.openframe.api.dto.rmm.schedulerun.ScheduleRunResponse;
import com.openframe.api.mapper.GraphQLScheduleRunMapper;
import com.openframe.api.service.rmm.schedule.ScheduleRunFilterService;
import com.openframe.api.service.rmm.schedule.ScheduleRunService;
import graphql.relay.Relay;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ScheduleRunDataFetcherTest {

    @Mock
    private ScheduleRunService scheduleRunService;
    @Mock
    private ScheduleRunFilterService scheduleRunFilterService;
    @Mock
    private GraphQLScheduleRunMapper mapper;

    @InjectMocks
    private ScheduleRunDataFetcher dataFetcher;

    @Test
    @DisplayName("scheduleRun: decodes the Relay id and returns the run from the service (typed node(id) alternative)")
    void scheduleRun_returnsByDecodedGlobalId() {
        String rawId = "run-1";
        String globalId = new Relay().toGlobalId("ScheduleRun", rawId);
        ScheduleRunResponse response = ScheduleRunResponse.builder().id(rawId).build();
        when(scheduleRunService.get(rawId)).thenReturn(response);

        assertThat(dataFetcher.scheduleRun(globalId)).isSameAs(response);
        verify(scheduleRunService).get(rawId);
    }

    @Test
    @DisplayName("ScheduleRun.id resolver returns the Relay global id (\"ScheduleRun:<rawId>\")")
    void scheduleRunNodeId_returnsGlobalId() {
        DgsDataFetchingEnvironment dfe = mock(DgsDataFetchingEnvironment.class);
        doReturn(ScheduleRunResponse.builder().id("run-1").build()).when(dfe).getSource();

        assertThat(dataFetcher.scheduleRunNodeId(dfe)).isEqualTo(new Relay().toGlobalId("ScheduleRun", "run-1"));
    }
}
