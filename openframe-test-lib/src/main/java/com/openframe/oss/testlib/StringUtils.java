package com.openframe.oss.testlib;

import lombok.experimental.UtilityClass;
import lombok.extern.slf4j.Slf4j;

/**
 * Sample utility class for string operations.
 * This is a demonstration library for the Maven release workflow.
 */
@Slf4j
@UtilityClass
public class StringUtils {

    /**
     * Reverses the given string.
     *
     * @param input the string to reverse
     * @return the reversed string, or null if input is null
     */
    public String reverse(String input) {
        if (input == null) {
            log.debug("Input string is null, returning null");
            return null;
        }
        
        String reversed = new StringBuilder(input).reverse().toString();
        log.debug("Reversed '{}' to '{}'", input, reversed);
        return reversed;
    }

    /**
     * Checks if a string is a palindrome.
     *
     * @param input the string to check
     * @return true if the string is a palindrome, false otherwise
     */
    public boolean isPalindrome(String input) {
        if (input == null || input.isEmpty()) {
            return false;
        }
        
        String normalized = input.toLowerCase().replaceAll("[^a-z0-9]", "");
        String reversed = reverse(normalized);
        
        boolean result = normalized.equals(reversed);
        log.debug("String '{}' is {}a palindrome", input, result ? "" : "not ");
        return result;
    }

    /**
     * Capitalizes the first letter of each word in the string.
     *
     * @param input the string to capitalize
     * @return the string with capitalized words
     */
    public String capitalizeWords(String input) {
        if (input == null || input.isEmpty()) {
            return input;
        }
        
        String[] words = input.split("\\s+");
        StringBuilder result = new StringBuilder();
        
        for (int i = 0; i < words.length; i++) {
            if (!words[i].isEmpty()) {
                result.append(Character.toUpperCase(words[i].charAt(0)));
                if (words[i].length() > 1) {
                    result.append(words[i].substring(1).toLowerCase());
                }
            }
            if (i < words.length - 1) {
                result.append(" ");
            }
        }
        
        log.debug("Capitalized '{}' to '{}'", input, result.toString());
        return result.toString();
    }
}