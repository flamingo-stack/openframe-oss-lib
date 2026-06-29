package com.openframe.data.config;

import org.springframework.core.convert.converter.Converter;
import org.springframework.data.convert.ReadingConverter;
import org.springframework.data.convert.WritingConverter;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.Date;
import java.util.List;

/**
 * UTC {@link LocalDate} &lt;-&gt; Mongo {@code Date} converters, shared by every config that builds a
 * {@code MongoCustomConversions}.
 * <p>
 * Spring's default JSR-310 converters use {@code ZoneId.systemDefault()}, so the same {@code LocalDate}
 * is persisted at a different instant by pods in different timezones (UTC stores midnight as
 * {@code 00:00Z}, CEST as the previous day's {@code 22:00Z} — 2h apart). That made
 * {@code product_usage_periods} exact-date dedup miss the existing doc and insert duplicate/overlapping
 * period docs. Pinning to UTC makes every pod encode the same logical date identically.
 */
public final class LocalDateUtcMongoConverters {

    private LocalDateUtcMongoConverters() {
    }

    /** The UTC LocalDate converters, to be added to any {@code MongoCustomConversions}. */
    public static List<Object> converters() {
        return List.of(LocalDateToUtcDateConverter.INSTANCE, UtcDateToLocalDateConverter.INSTANCE);
    }

    @WritingConverter
    public enum LocalDateToUtcDateConverter implements Converter<LocalDate, Date> {
        INSTANCE;

        @Override
        public Date convert(LocalDate source) {
            return Date.from(source.atStartOfDay(ZoneOffset.UTC).toInstant());
        }
    }

    @ReadingConverter
    public enum UtcDateToLocalDateConverter implements Converter<Date, LocalDate> {
        INSTANCE;

        @Override
        public LocalDate convert(Date source) {
            return LocalDateTime.ofInstant(source.toInstant(), ZoneOffset.UTC).toLocalDate();
        }
    }
}
