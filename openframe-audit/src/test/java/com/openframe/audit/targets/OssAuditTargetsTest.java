package com.openframe.audit.targets;

import com.openframe.data.document.audit.AuditTargetType;
import com.openframe.data.document.auth.AuthUser;
import com.openframe.data.document.user.User;
import org.junit.jupiter.api.Test;
import org.springframework.core.ResolvableType;
import org.springframework.util.ReflectionUtils;

import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

class OssAuditTargetsTest {

    private static final String MONGO_ID_FIELD = "_id";

    private final OssAuditTargets provider = new OssAuditTargets();

    @Test
    void targets_everyFieldTheyName_existsOnTheStoredRecord() {
        assertThat(provider.targets()).allSatisfy(target ->
                assertThat(storedFieldsOf(target.documentType())).containsAll(namedFieldsOf(target)));
    }

    @Test
    void targets_maskInsideAField_namesAFieldOfWhatThatFieldHolds() {
        assertThat(provider.targets()).allSatisfy(target -> target.maskedFields().stream()
                .filter(masked -> masked.contains("."))
                .forEach(masked -> assertThat(fieldsHeldBy(target.documentType(), masked.split("\\.")[0]))
                        .contains(masked.substring(masked.indexOf('.') + 1))));
    }

    @Test
    void targets_deviceFieldsTheAgentOsReportWrites_ignored() {
        Set<String> ignoredOnDevice = provider.targets().stream()
                .filter(target -> target.type() == AuditTargetType.DEVICE)
                .flatMap(target -> target.ignoredFields().stream())
                .collect(Collectors.toSet());

        assertThat(ignoredOnDevice).contains("osState", "osVersion", "osBuild");
    }

    private static Set<String> namedFieldsOf(AuditTarget<?> target) {
        Set<String> named = new HashSet<>(target.ignoredFields());
        target.maskedFields().forEach(masked -> named.add(masked.split("\\.")[0]));
        named.addAll(target.childActions().keySet());
        if (!MONGO_ID_FIELD.equals(target.idField())) {
            named.add(target.idField());
        }
        return named;
    }

    private static Set<String> fieldsHeldBy(Class<?> recordType, String field) {
        Set<String> names = new HashSet<>();
        addFieldsOf(ResolvableType.forField(ReflectionUtils.findField(recordType, field)), names, new HashSet<>());
        return names;
    }

    private static void addFieldsOf(ResolvableType type, Set<String> names, Set<Class<?>> seen) {
        Arrays.stream(type.getGenerics()).forEach(argument -> addFieldsOf(argument, names, seen));
        Class<?> holder = type.resolve();
        if (holder == null || holder.getName().startsWith("java.") || !seen.add(holder)) {
            return;
        }
        Stream.<Class<?>>iterate(holder, Objects::nonNull, Class::getSuperclass)
                .flatMap(declaring -> Arrays.stream(declaring.getDeclaredFields()))
                .filter(declared -> !Modifier.isStatic(declared.getModifiers()))
                .forEach(declared -> {
                    names.add(declared.getName());
                    addFieldsOf(ResolvableType.forField(declared), names, seen);
                });
    }

    private static Set<String> storedFieldsOf(Class<?> documentType) {
        Class<?> storedType = documentType == User.class ? AuthUser.class : documentType;
        return Stream.<Class<?>>iterate(storedType, Objects::nonNull, Class::getSuperclass)
                .flatMap(type -> Arrays.stream(type.getDeclaredFields()))
                .map(Field::getName)
                .collect(Collectors.toSet());
    }
}
