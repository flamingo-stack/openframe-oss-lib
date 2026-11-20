package com.openframe.api.service.rmm.software;

import com.openframe.data.document.rmm.software.SoftwareAction;
import com.openframe.data.document.rmm.software.SoftwareActionKind;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

class SoftwareActionKindMapperTest {

    @ParameterizedTest
    @MethodSource("kinds")
    void kindOf_everyAction_theKindOfTheSameName(SoftwareAction action, SoftwareActionKind expected) {
        // setup
        SoftwareAction given = action;

        // execution
        SoftwareActionKind kind = SoftwareActionKindMapper.kindOf(given);

        // verifications
        assertThat(kind).isEqualTo(expected);
    }

    private static Stream<Arguments> kinds() {
        return Stream.of(
                Arguments.of(SoftwareAction.INSTALL, SoftwareActionKind.INSTALL),
                Arguments.of(SoftwareAction.UPDATE, SoftwareActionKind.UPDATE),
                Arguments.of(SoftwareAction.ADOPT, SoftwareActionKind.ADOPT));
    }
}
