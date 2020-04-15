// ==UserScript==
// @name         LeetCode Session Helper
// @namespace    https://github.com/titlis/leetcode-session-helper
// @version      1.0
// @description  Create a dropdown to allow user to switch between sessions and enforce the selected user session on the client side.
// @author       titlis
// @match        https://*.leetcode.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @require      http://code.jquery.com/jquery-latest.js
// ==/UserScript==

(function() {
    'use strict';

    var getSessions = function(callback) {
        $.ajax({
            url: 'https://leetcode.com/session/',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({}),
            success: function(data) {
                var sessions = JSON.parse(data);
                callback(sessions['sessions']);
            }
        });
    }

    var getActiveSession = function(sessions) {
        for (var i = 0; i < sessions.length; i++) {
            if (sessions[i]['is_active']) {
                return sessions[i]['id'];
            }
        }
        return -1;
    }

    var setSession = function(sid, callback) {
        $.ajax({
            url: 'https://leetcode.com/session/',
            type: 'PUT',
            contentType: 'application/json',
            data: JSON.stringify({
                "func": "activate",
                "target": sid
            }),
            success: function(data) {
                if (callback) callback();
            }
        });
    }

    var setSelectedSessionIfNotActive = async function(sessions) {
        var active_session = getActiveSession(sessions);
        var selected_session = await GM_getValue("leetcode_selected_session", active_session);
        if (active_session != selected_session) {
            setSession(selected_session, reloadPage);
        }
    }

    var reloadPage = function() {
        location.href = location.href;
    }

    var waitForPageLoaded = function(callback) {
        var submitButton = $("[class^=submit]");
        if (submitButton == null || submitButton.length == 0) {
            console.log("could not find the submit button, try again in 2 seconds");
            setTimeout(function(){waitForPageLoaded(callback)}, 2000);
            return;
        }
        if (callback) callback();
    }

    var pageLoadedCallBack = function() {
        replaceSubmitButton();
        listenOnSubmitButtonChange();
    }

    var listenOnSubmitButtonChange = function() {
        var submitButton = $("[class^=submit]");

        MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
        var observer = new MutationObserver(function(mutations, observer) {
            mutations.forEach(function(mutation) {
                if (mutation.addedNodes.length > 0) {
                    var classString = mutation.addedNodes[0].className;
                    if (classString.includes("submit") && !classString.includes("custom-button")) {
                        replaceSubmitButton();
                    }
                } else if (mutation.removedNodes.length > 0) {
                    var classString = mutation.removedNodes[0].className;
                    if (classString.includes("submit") && !classString.includes("custom-button")) {
                        $("[class^=submit]").remove();
                    }
                }
            });
        });

        observer.observe(submitButton.parent()[0], {
            childList: true
        });
    }

    var replaceSubmitButton = async function() {
        var submitButton = $("[class^=submit]");
        var customButton = submitButton.clone();
        customButton.addClass("custom-button");
        customButton.unbind();
        customButton.click(function() {
            getSessions(async function(sessions) {
                var active_session = getActiveSession(sessions);
                var selected_session = await GM_getValue("leetcode_selected_session", active_session);
                if (active_session != selected_session) {
                    setSession(selected_session, function() {
                        submitButton.trigger("click");
                    });
                } else {
                    submitButton.trigger("click");
                }
            });
        });
        customButton.appendTo(submitButton.parent());
        submitButton.hide();
    }

    var createDropdown = async function(sessions) {
        var navbar = $("#navbar-right");
        if (navbar == null || navbar.length == 0) {
            navbar = $("#navbar-right-container");
        }
        if (navbar == null || navbar.length == 0) {
            setTimeout(function(){createDropdown(sessions)}, 2000);
            return;
        }
        navbar.prepend('<li id="nav-user-app"><span class="dropdown notification-btn-dropdown"><select id="sessions"></select></span></li>');
        var select = navbar.find("select#sessions");
        var selected_session = await GM_getValue("leetcode_selected_session", getActiveSession(sessions));
        for (var i = 0; i < sessions.length; i++) {
            var session_name = sessions[i]['name'];
            if (session_name == "") {
                session_name = "Anonymous Session";
            }
            select.append('<option id="' + sessions[i]['id'] + '" value="' + sessions[i]['id'] + '">' + session_name + '</option>');
        }
        var selected_option = select.find('option#' + selected_session);
        selected_option.prop('selected', true);

        select.change(function() {
            GM_setValue("leetcode_selected_session", this.value);
            setSession(this.value, reloadPage);
        });
    }

    var isProblemPage = function(url) {
        return /https:\/\/leetcode.com\/problems\/.*/.test(url)
    }

    var handleSessions = function(sessions) {
        setSelectedSessionIfNotActive(sessions);
        createDropdown(sessions);
        if (isProblemPage(location.href)) {
            waitForPageLoaded(pageLoadedCallBack);
        }
    }

    getSessions(handleSessions);
})();
