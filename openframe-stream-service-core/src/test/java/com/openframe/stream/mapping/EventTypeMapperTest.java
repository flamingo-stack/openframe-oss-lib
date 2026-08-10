package com.openframe.stream.mapping;

import com.openframe.data.cassandra.model.enums.UnifiedEventType;
import com.openframe.data.model.enums.IntegratedToolType;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.junit.jupiter.api.Assertions.assertEquals;

class EventTypeMapperTest {

    @ParameterizedTest
    @CsvSource({
            "UserManagement, M365_USER_MANAGEMENT",
            "GroupManagement, M365_GROUP_MANAGEMENT",
            "ApplicationManagement, M365_APPLICATION_MANAGEMENT",
            "RoleManagement, M365_ROLE_MANAGEMENT",
            "Policy, M365_POLICY",
            "DirectoryManagement, M365_DIRECTORY_MANAGEMENT"
    })
    void mapsMicrosoft365CategoriesToUnifiedTypes(String category, UnifiedEventType expected) {
        assertEquals(expected, EventTypeMapper.mapToUnifiedType(IntegratedToolType.MICROSOFT_365, category));
    }

    @Test
    void unmappedMicrosoft365CategoryFallsBackToUnknown() {
        assertEquals(UnifiedEventType.UNKNOWN,
                EventTypeMapper.mapToUnifiedType(IntegratedToolType.MICROSOFT_365, "KeyManagement"));
    }

    @Test
    void categoryMappingIsToolScoped() {
        assertEquals(UnifiedEventType.UNKNOWN,
                EventTypeMapper.mapToUnifiedType(IntegratedToolType.FLEET, "UserManagement"));
    }

    @ParameterizedTest
    @CsvSource({
            "USER_SETTINGS, GWS_USER_MANAGEMENT",
            "GROUP_SETTINGS, GWS_GROUP_MANAGEMENT",
            "SECURITY_SETTINGS, GWS_SECURITY_SETTINGS",
            "DOMAIN_SETTINGS, GWS_DOMAIN_SETTINGS",
            "DELEGATED_ADMIN_SETTINGS, GWS_DELEGATED_ADMIN"
    })
    void mapsGoogleWorkspaceEventTypesToUnifiedTypes(String eventType, UnifiedEventType expected) {
        assertEquals(expected, EventTypeMapper.mapToUnifiedType(IntegratedToolType.GOOGLE_WORKSPACE, eventType));
    }

    @Test
    void googleWorkspaceMappingIsToolScoped() {
        assertEquals(UnifiedEventType.UNKNOWN,
                EventTypeMapper.mapToUnifiedType(IntegratedToolType.GOOGLE_WORKSPACE, "UserManagement"));
        assertEquals(UnifiedEventType.UNKNOWN,
                EventTypeMapper.mapToUnifiedType(IntegratedToolType.MICROSOFT_365, "USER_SETTINGS"));
    }
}
