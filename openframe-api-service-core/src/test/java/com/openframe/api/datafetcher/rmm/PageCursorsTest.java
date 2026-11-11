package com.openframe.api.datafetcher.rmm;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.assertj.core.api.Assertions.assertThat;

class PageCursorsTest {

    @ParameterizedTest(name = "first={0}, last={1} -> {2}")
    @CsvSource(nullValues = "null", value = {
            "null, null, 20",
            "0,    null, 20",
            "-5,   null, 20",
            "1,    null, 1",
            "20,   null, 20",
            "100,  null, 100",
            "101,  null, 100",
            "5000, null, 100",
            "null, 30,   30",
            "null, 500,  100",
            "10,   50,   10"
    })
    void pageSize_boundsTheRequestedSize(Integer first, Integer last, int expected) {
        // execution
        int size = PageCursors.pageSize(first, last);

        // verifications
        assertThat(size).isEqualTo(expected);
    }
}
