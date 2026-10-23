package com.openframe.api.service.rmm;

import com.openframe.api.service.rmm.script.ScriptPrivilegeValidator;
import com.openframe.core.exception.BadRequestException;
import com.openframe.data.document.rmm.script.OsType;
import com.openframe.data.document.rmm.script.PrivilegeLevel;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

import java.util.List;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ScriptPrivilegeValidatorTest {

    private static final List<OsType> WINDOWS_ONLY = List.of(OsType.WINDOWS);

    private final ScriptPrivilegeValidator validator = new ScriptPrivilegeValidator();

    @ParameterizedTest
    @MethodSource("nonElevatedLevelsOnAnyPlatforms")
    void validate_userOrAdmin_allowedOnAnyPlatforms(PrivilegeLevel level, List<OsType> platforms) {
        // execution + verifications
        assertThatCode(() -> validator.validate(level, platforms)).doesNotThrowAnyException();
    }

    @Test
    void validate_elevatedUserOnWindowsOnly_allowed() {
        // execution + verifications
        assertThatCode(() -> validator.validate(PrivilegeLevel.ELEVATED_USER, WINDOWS_ONLY))
                .doesNotThrowAnyException();
    }

    @ParameterizedTest
    @MethodSource("platformsThatCannotRunElevatedUser")
    void validate_elevatedUserOffWindows_rejected(List<OsType> platforms) {
        // execution + verifications
        assertThatThrownBy(() -> validator.validate(PrivilegeLevel.ELEVATED_USER, platforms))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("WINDOWS");
    }

    private static Stream<Arguments> nonElevatedLevelsOnAnyPlatforms() {
        return Stream.of(
                Arguments.of(PrivilegeLevel.USER, null),
                Arguments.of(PrivilegeLevel.ADMIN, List.of(OsType.MAC_OS)),
                Arguments.of(PrivilegeLevel.USER, WINDOWS_ONLY));
    }

    private static Stream<Arguments> platformsThatCannotRunElevatedUser() {
        return Stream.of(
                Arguments.of((Object) null),
                Arguments.of(List.of()),
                Arguments.of(List.of(OsType.MAC_OS)),
                Arguments.of(List.of(OsType.WINDOWS, OsType.MAC_OS)));
    }
}
