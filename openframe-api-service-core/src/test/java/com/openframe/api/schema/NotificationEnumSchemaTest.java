package com.openframe.api.schema;

import com.openframe.data.document.notification.NotificationCategory;
import com.openframe.data.document.notification.NotificationEntityType;
import com.openframe.data.document.notification.NotificationSettingGroup;
import com.openframe.data.document.notification.NotificationSeverity;
import com.openframe.data.document.notification.ReadStatus;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

// A value the Java enum knows and the schema does not is invisible until a row actually carries it,
// and then the whole response fails to serialize — the notification list, the unread counts or the
// settings page, for every user at once rather than the one row that carries it.
class NotificationEnumSchemaTest {

    private static final String NOTIFICATION_SCHEMA = "/schema/notification.graphqls";
    private static final String SETTINGS_SCHEMA = "/schema/notification-settings.graphqls";

    static Stream<Arguments> enumsExposedInTheSchema() {
        return Stream.of(
                Arguments.of("NotificationCategory", NOTIFICATION_SCHEMA, NotificationCategory.class),
                Arguments.of("NotificationEntityType", NOTIFICATION_SCHEMA, NotificationEntityType.class),
                Arguments.of("NotificationSeverity", NOTIFICATION_SCHEMA, NotificationSeverity.class),
                Arguments.of("NotificationReadStatus", NOTIFICATION_SCHEMA, ReadStatus.class),
                Arguments.of("NotificationSettingGroup", SETTINGS_SCHEMA, NotificationSettingGroup.class));
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("enumsExposedInTheSchema")
    void theSchemaOffersEveryValueTheEnumCanProduce(String graphqlName, String resource, Class<? extends Enum<?>> javaEnum) {
        List<String> declared = valuesInSchema(graphqlName, resource);

        Enum<?>[] constants = javaEnum.getEnumConstants();
        List<String> known = Arrays.stream(constants)
                .map(Enum::name)
                .toList();

        assertThat(declared).containsExactlyElementsOf(known);
    }

    private List<String> valuesInSchema(String graphqlName, String resource) {
        String schema = readSchema(resource);
        Pattern body = Pattern.compile("enum\\s+" + graphqlName + "\\s*\\{([^}]*)}", Pattern.DOTALL);
        Matcher matcher = body.matcher(schema);
        assertThat(matcher.find()).as("%s is declared in %s", graphqlName, resource).isTrue();

        return matcher.group(1).lines()
                .map(String::trim)
                .filter(line -> !line.isEmpty())
                .filter(line -> !line.startsWith("#"))
                .filter(line -> !line.startsWith("\""))
                .toList();
    }

    private String readSchema(String resource) {
        try (InputStream stream = getClass().getResourceAsStream(resource)) {
            assertThat(stream).as("%s is on the test classpath", resource).isNotNull();
            byte[] bytes = stream.readAllBytes();
            return new String(bytes, StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new IllegalStateException("Could not read " + resource, e);
        }
    }
}
