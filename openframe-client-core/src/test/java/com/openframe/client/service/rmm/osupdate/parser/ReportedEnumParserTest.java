package com.openframe.client.service.rmm.osupdate.parser;

import com.openframe.client.metrics.DeviceOsReportMetrics;
import com.openframe.data.document.rmm.osupdate.MacosUpdatePresence;
import com.openframe.data.document.rmm.osupdate.OsPatchState;
import com.openframe.data.document.rmm.osupdate.OsPlatform;
import com.openframe.data.document.rmm.osupdate.OsUpdateListConfidence;
import com.openframe.data.document.rmm.osupdate.OsUpdateSeverity;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

@ExtendWith(MockitoExtension.class)
class ReportedEnumParserTest {

    @Mock private DeviceOsReportMetrics deviceOsReportMetrics;

    @InjectMocks private ReportedEnumParser parser;

    @ParameterizedTest
    @MethodSource("knownValues")
    <E extends Enum<E>> void parse_knownValueInAnyCase_constantReturned(Class<E> enumType, String reported, E expected) {
        // setup

        // execution
        E parsed = parser.parse(enumType, reported);

        // verifications
        assertThat(parsed).isEqualTo(expected);
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", " "})
    void parse_nothingReported_null(String reported) {
        // setup

        // execution
        OsPlatform parsed = parser.parse(OsPlatform.class, reported);

        // verifications
        assertThat(parsed).isNull();
    }

    @ParameterizedTest
    @ValueSource(strings = {"LINUX", "WINDOWS_ARM", "windows 11", "MAC"})
    void parse_valueTheBackendDoesNotKnow_nullAndNoFailure(String reported) {
        // setup

        // execution
        OsPlatform parsed = parser.parse(OsPlatform.class, reported);

        // verifications
        assertThat(parsed).isNull();
    }

    @Test
    void parse_valueOfAnotherEnum_null() {
        // setup

        // execution
        OsUpdateSeverity parsed = parser.parse(OsUpdateSeverity.class, "CONFIRMED");

        // verifications
        assertThat(parsed).isNull();
    }

    @Test
    void parse_valueTheBackendDoesNotKnow_countedUnderTheEnumType() {
        // setup

        // execution
        parser.parse(OsUpdateSeverity.class, "CATASTROPHIC");

        // verifications
        verify(deviceOsReportMetrics).recordUnknownValue(OsUpdateSeverity.class);
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", " ", "WINDOWS", "macos"})
    void parse_nothingReportedOrAKnownValue_notCountedAsUnknown(String reported) {
        // setup

        // execution
        parser.parse(OsPlatform.class, reported);

        // verifications
        verifyNoInteractions(deviceOsReportMetrics);
    }

    private static Stream<Arguments> knownValues() {
        return Stream.of(
                Arguments.of(OsPlatform.class, "WINDOWS", OsPlatform.WINDOWS),
                Arguments.of(OsPlatform.class, "macos", OsPlatform.MACOS),
                Arguments.of(OsUpdateSeverity.class, "Critical", OsUpdateSeverity.CRITICAL),
                Arguments.of(OsUpdateSeverity.class, " Important ", OsUpdateSeverity.IMPORTANT),
                Arguments.of(OsUpdateListConfidence.class, "TOO_LARGE", OsUpdateListConfidence.TOO_LARGE),
                Arguments.of(OsPatchState.class, "up to date", OsPatchState.UP_TO_DATE),
                Arguments.of(OsPatchState.class, "Updates-Available", OsPatchState.UPDATES_AVAILABLE),
                Arguments.of(MacosUpdatePresence.class, "HELD_OVER", MacosUpdatePresence.HELD_OVER));
    }
}
