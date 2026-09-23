package com.openframe.external.controller;

import com.openframe.api.dto.shared.SortDirection;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.api.dto.tool.ToolFilterCriteria;
import com.openframe.api.dto.tool.ToolFilters;
import com.openframe.api.dto.tool.ToolList;
import com.openframe.api.service.ToolService;
import com.openframe.data.document.apikey.APIKeyType;
import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.data.document.tool.ToolApiKey;
import com.openframe.data.document.tool.ToolCredentials;
import com.openframe.data.document.tool.ToolUrl;
import com.openframe.data.document.tool.ToolUrlType;
import com.openframe.external.mapper.ToolMapper;
import com.openframe.external.support.ExternalApiMockMvc;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class ToolControllerTest {

    private static final String BASE = "/api/v1/tools";

    @Mock
    private ToolService toolService;

    @Captor
    private ArgumentCaptor<ToolFilterCriteria> filterCaptor;
    @Captor
    private ArgumentCaptor<SortInput> sortCaptor;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = ExternalApiMockMvc.standalone(new ToolController(toolService, new ToolMapper()));
    }

    @Test
    void toolsAreReturnedWithUrlsAndCredentials() throws Exception {
        ToolApiKey apiKey = new ToolApiKey();
        apiKey.setKey("s3cr3t");
        apiKey.setType(APIKeyType.HEADER);
        apiKey.setKeyName("X-Auth-Token");
        ToolCredentials credentials = new ToolCredentials();
        credentials.setUsername("admin");
        credentials.setApiKey(apiKey);
        IntegratedTool tool = IntegratedTool.builder()
                .id("tool-1")
                .key("tactical-rmm")
                .name("Tactical RMM")
                .description("Remote monitoring")
                .icon("tactical.svg")
                .toolUrls(List.of(new ToolUrl("http://rmm-api", "8000", ToolUrlType.API)))
                .type("RMM")
                .toolType("TACTICAL_RMM")
                .category("Monitoring")
                .platformCategory("Integrated")
                .enabled(true)
                .credentials(credentials)
                .layer("Application")
                .layerOrder(3)
                .healthCheckInterval(30)
                .allowedEndpoints(new String[]{"/api/agents"})
                .build();
        when(toolService.queryTools(any(), any(), any())).thenReturn(
                ToolList.builder().tools(List.of(tool, IntegratedTool.builder().id("tool-2").build())).build());

        mockMvc.perform(get(BASE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tools.length()").value(2))
                .andExpect(jsonPath("$.tools[0].id").value("tool-1"))
                .andExpect(jsonPath("$.tools[0].name").value("Tactical RMM"))
                .andExpect(jsonPath("$.tools[0].description").value("Remote monitoring"))
                .andExpect(jsonPath("$.tools[0].icon").value("tactical.svg"))
                .andExpect(jsonPath("$.tools[0].toolUrls[0].url").value("http://rmm-api"))
                .andExpect(jsonPath("$.tools[0].toolUrls[0].port").value("8000"))
                .andExpect(jsonPath("$.tools[0].toolUrls[0].type").value("API"))
                .andExpect(jsonPath("$.tools[0].type").value("RMM"))
                .andExpect(jsonPath("$.tools[0].toolType").value("TACTICAL_RMM"))
                .andExpect(jsonPath("$.tools[0].category").value("Monitoring"))
                .andExpect(jsonPath("$.tools[0].platformCategory").value("Integrated"))
                .andExpect(jsonPath("$.tools[0].enabled").value(true))
                .andExpect(jsonPath("$.tools[0].credentials.username").value("admin"))
                .andExpect(jsonPath("$.tools[0].credentials.apiKey.type").value("HEADER"))
                .andExpect(jsonPath("$.tools[0].credentials.apiKey.keyName").value("X-Auth-Token"))
                .andExpect(jsonPath("$.tools[0].layer").value("Application"))
                .andExpect(jsonPath("$.tools[0].layerOrder").value(3))
                .andExpect(jsonPath("$.tools[0].healthCheckInterval").value(30))
                .andExpect(jsonPath("$.tools[0].allowedEndpoints[0]").value("/api/agents"))
                .andExpect(jsonPath("$.tools[1].id").value("tool-2"))
                .andExpect(jsonPath("$.tools[1].enabled").value(false));
    }

    @Test
    void everyQueryParamLandsInItsFilterSearchOrSortField() throws Exception {
        when(toolService.queryTools(any(), any(), any())).thenReturn(emptyList());

        mockMvc.perform(get(BASE)
                        .param("enabled", "true")
                        .param("type", "RMM")
                        .param("search", "tactical")
                        .param("category", "Monitoring")
                        .param("platformCategory", "Integrated")
                        .param("sortField", "name")
                        .param("sortDirection", "DESC"))
                .andExpect(status().isOk());

        verify(toolService).queryTools(filterCaptor.capture(), eq("tactical"), sortCaptor.capture());
        assertEquals(ToolFilterCriteria.builder()
                .enabled(true)
                .type("RMM")
                .category("Monitoring")
                .platformCategory("Integrated")
                .build(), filterCaptor.getValue());
        assertEquals(new SortInput("name", SortDirection.DESC), sortCaptor.getValue());
    }

    @Test
    void noParamsMeansEmptyFilterNoSearchAndNoSort() throws Exception {
        when(toolService.queryTools(any(), any(), any())).thenReturn(emptyList());

        mockMvc.perform(get(BASE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tools").isEmpty());

        verify(toolService).queryTools(eq(new ToolFilterCriteria()), isNull(), isNull());
    }

    @Test
    void enabledFalseIsPassedAsFalseNotAsAbsent() throws Exception {
        when(toolService.queryTools(any(), any(), any())).thenReturn(emptyList());

        mockMvc.perform(get(BASE).param("enabled", "false"))
                .andExpect(status().isOk());

        verify(toolService).queryTools(filterCaptor.capture(), isNull(), isNull());
        assertEquals(Boolean.FALSE, filterCaptor.getValue().getEnabled());
    }

    @Test
    void sortDirectionDefaultsToAscWhenOnlySortFieldIsGiven() throws Exception {
        when(toolService.queryTools(any(), any(), any())).thenReturn(emptyList());

        mockMvc.perform(get(BASE).param("sortField", "category"))
                .andExpect(status().isOk());

        verify(toolService).queryTools(any(), isNull(), sortCaptor.capture());
        assertEquals(new SortInput("category", SortDirection.ASC), sortCaptor.getValue());
    }

    @Test
    void nonBooleanEnabledIs400TypeMismatch() throws Exception {
        mockMvc.perform(get(BASE).param("enabled", "maybe"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("TYPE_MISMATCH"))
                .andExpect(jsonPath("$.message").value("Invalid value 'maybe' for parameter 'enabled'"));

        verifyNoInteractions(toolService);
    }

    @Test
    void databaseFailureOnQueryIs503() throws Exception {
        when(toolService.queryTools(any(), any(), any())).thenThrow(new DataAccessResourceFailureException("mongo down"));

        mockMvc.perform(get(BASE))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("DATABASE_ERROR"))
                .andExpect(jsonPath("$.message").value("Database operation failed. Please try again later."));
    }

    @Test
    void toolFiltersAreReturned() throws Exception {
        when(toolService.getToolFilters()).thenReturn(ToolFilters.builder()
                .types(List.of("RMM", "MDM"))
                .categories(List.of("Monitoring"))
                .platformCategories(List.of("Integrated", "Datasource"))
                .build());

        mockMvc.perform(get(BASE + "/filters"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.types.length()").value(2))
                .andExpect(jsonPath("$.types[0]").value("RMM"))
                .andExpect(jsonPath("$.types[1]").value("MDM"))
                .andExpect(jsonPath("$.categories[0]").value("Monitoring"))
                .andExpect(jsonPath("$.platformCategories[0]").value("Integrated"))
                .andExpect(jsonPath("$.platformCategories[1]").value("Datasource"));
    }

    @Test
    void databaseFailureOnFiltersIs503() throws Exception {
        when(toolService.getToolFilters()).thenThrow(new DataAccessResourceFailureException("mongo down"));

        mockMvc.perform(get(BASE + "/filters"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("DATABASE_ERROR"));
    }

    private static ToolList emptyList() {
        return ToolList.builder().tools(List.of()).build();
    }
}
