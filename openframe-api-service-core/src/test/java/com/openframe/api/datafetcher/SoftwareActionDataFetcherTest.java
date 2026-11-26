package com.openframe.api.datafetcher;

import com.netflix.graphql.dgs.DgsDataFetchingEnvironment;
import com.openframe.api.datafetcher.rmm.SoftwareActionDataFetcher;
import com.openframe.api.dto.rmm.software.SoftwareActionDeviceFilterInput;
import com.openframe.api.dto.rmm.software.SoftwareActionDeviceFilters;
import com.openframe.api.dto.rmm.software.SoftwareActionDeviceResponse;
import com.openframe.api.dto.rmm.software.SoftwareActionId;
import com.openframe.api.service.rmm.software.SoftwareActionDetailService;
import com.openframe.api.service.rmm.software.SoftwareActionService;
import graphql.execution.MergedField;
import graphql.language.Field;
import graphql.schema.DataFetchingEnvironmentImpl;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.support.GenericApplicationContext;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SoftwareActionDataFetcherTest {

    @Mock
    private SoftwareActionService softwareActionService;
    @Mock
    private SoftwareActionDetailService softwareActionDetailService;

    @InjectMocks
    private SoftwareActionDataFetcher dataFetcher;

    @Test
    void softwareActionExecutionFilters_actionId_passesItsKeysFilterAndSearch() {
        // setup
        SoftwareActionId id = SoftwareActionId.of("exec-1", "bundle-1", "schedule-1");
        String actionId = id.encode();
        SoftwareActionDeviceFilterInput filter = new SoftwareActionDeviceFilterInput();
        SoftwareActionDeviceFilters expected = SoftwareActionDeviceFilters.builder().filteredCount(3).build();
        when(softwareActionDetailService.filters("exec-1", "bundle-1", "schedule-1", filter, "acme"))
                .thenReturn(expected);

        // execution
        SoftwareActionDeviceFilters filters = dataFetcher.softwareActionExecutionFilters(actionId, filter, "acme");

        // verifications
        assertThat(filters).isSameAs(expected);
    }

    @ParameterizedTest
    @CsvSource({"stdout, Installed 7-Zip", "stderr, Reboot required"})
    void output_field_returnsThatFieldsOutput(String field, String expected) {
        SoftwareActionDeviceResponse device = SoftwareActionDeviceResponse.builder()
                .stdout("Installed 7-Zip").stderr("Reboot required").build();
        DgsDataFetchingEnvironment environment = new DgsDataFetchingEnvironment(
                DataFetchingEnvironmentImpl.newDataFetchingEnvironment()
                        .source(device)
                        .mergedField(MergedField.newMergedField(Field.newField(field).build()).build())
                        .build(), new GenericApplicationContext());

        assertThat(dataFetcher.output(environment)).isEqualTo(expected);
    }
}
