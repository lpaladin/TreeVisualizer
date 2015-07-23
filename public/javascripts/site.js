// 全局前端控制脚本（All-In-One）
// 作者：zhouhy
// *部分来自 Botzone2 脚本
/*
 * socket.io类型定义结束。
 */
/*
 * 以下是对通用表单提交逻辑的实现。
 */
var validateFunctions = {
    dummy: function (val) { return null; },
    nonNull: function (val) { return (val === null || val == undefined || val.length == 0) ? "不可为空 / Cannot be left blank" : null; }
};
var FormConfig = (function () {
    function FormConfig(options) {
        for (var i in options)
            this[i] = options[i];
    }
    return FormConfig;
})();
var configs = {
    "frmUploadTree": new FormConfig({
        method: "post",
        action: "/trees/new",
        ajaxFile: true,
        onResult: function (result) {
            if (result.success == false) {
                this.setFormResponse(result.message, true);
            }
            else {
                this.setFormResponse("表单提交成功 / Success", false);
                setTimeout(function () {
                    window.location.reload();
                }, 2000);
            }
        },
        onError: function (jqXHR, textStatus, errorThrown) {
            this.setFormResponse("出现错误 / Error：" + errorThrown, true);
        }
    })
};
function ValidateCtrl(ctrl, validateFunc) {
    if (!(ctrl instanceof jQuery))
        ctrl = $(ctrl);
    var result = validateFunc(ctrl.val()), data = new Object();
    if (result) {
        if (ctrl.attr("type") != "hidden")
            $(ctrl.tooltip("enable").attr("data-original-title", result).parent()).removeClass("has-success").addClass("has-error");
        return false;
    }
    else {
        if (ctrl.attr("type") != "hidden")
            $(ctrl.tooltip("disable").parent()).removeClass("has-error").addClass("has-success");
        return true;
    }
}
function ValidateAndSubmit(formid) {
    var form = $("#" + formid), result = true, data = new Object(), config = configs[formid];
    if (!config.setFormResponse)
        config.setFormResponse = function (message, isFailed) {
            if (isFailed)
                form.find(".alert").slideDown().text(message).removeClass("alert-success").addClass("alert-danger").css({ whiteSpace: "pre" });
            else
                form.find(".alert").slideDown().text(message).removeClass("alert-danger").addClass("alert-success").css({ whiteSpace: "normal" });
        };
    if (!config.setFieldError)
        config.setFieldError = function (selector, message) {
            if (message)
                $(form.find(selector).effect("highlight", 1000).tooltip("enable").attr("data-original-title", message).tooltip("show").parent())
                    .removeClass("has-success").addClass("has-error");
            else
                $(form.find(selector).tooltip("disable").parent()).removeClass("has-error").addClass("has-success");
        };
    form.find("[data-validatefunc]").each(function (i, ele) {
        ele = $(ele);
        if (ValidateCtrl(ele, validateFunctions[ele.data("validatefunc")])) {
            ele.tooltip("hide");
            var name = ele.attr("name");
            var thisVal;
            if (ele.attr("type") == "checkbox") {
                ele.val("true");
                if (name && name.length > 0)
                    thisVal = ele[0].checked;
            }
            else if (ele.attr("type") == "radio") {
                if (name && name.length > 0 && ele[0].checked)
                    thisVal = ele.val();
            }
            else if (name && name.length > 0)
                thisVal = ele.val();
            if (thisVal) {
                if (!data[name])
                    data[name] = thisVal;
                else if (data[name] instanceof Array)
                    data[name].push(thisVal);
                else
                    data[name] = [data[name], thisVal];
            }
        }
        else {
            ele.tooltip("show").effect("highlight", 1000);
            result = false;
        }
    });
    if (result && config.finalValidate instanceof Function) {
        result = config.finalValidate(form);
    }
    if (result) {
        if (FormConfig.ldscreen)
            FormConfig.ldscreen.fadeIn();
        $("body,html").animate({
            scrollTop: 0
        }, 100);
        if (config.ajaxFile) {
            $("#submitTarget").one("load", function () {
                var data = this.contentWindow.document.documentElement.innerHTML;
                try {
                    data = JSON.parse(/{[^]*}/.exec(data)[0]);
                    if (FormConfig.ldscreen)
                        FormConfig.ldscreen.fadeOut();
                    config.onResult(data);
                }
                catch (ex) {
                    if (FormConfig.ldscreen)
                        FormConfig.ldscreen.fadeOut();
                    config.onError(null, null, ex);
                }
            });
            form.attr("target", "submitTarget").attr("method", config.method)
                .attr("action", config.action).attr("enctype", "multipart/form-data")
                .removeAttr("onsubmit").submit();
        }
        else
            $[config.method](config.action, data, function (recvData) {
                if (FormConfig.ldscreen)
                    FormConfig.ldscreen.fadeOut();
                config.onResult(recvData);
            }, "json").fail(function (jqXHR, textStatus, errorThrown) {
                if (FormConfig.ldscreen)
                    FormConfig.ldscreen.fadeOut();
                config.onError(jqXHR, textStatus, errorThrown);
            });
    }
}
// 初始化页面组件
$(document).ready(function () {
    FormConfig.ldscreen = $("#loading");
    // 自动表单验证
    $(document).delegate("[data-validatefunc]", "blur", function () {
        var me = $(this);
        me.tooltip({ placement: "auto top" });
        ValidateCtrl(me, validateFunctions[me.data("validatefunc")]);
    })
        .delegate(".numeric", "keypress", function (event) {
        if ((event.keyCode || event.which) < 48 || (event.keyCode || event.which) > 57)
            return false;
    });
    // 弹出框点击页面关闭
    var popoverToggles = $('.popover-toggle');
    $('body').on('click', function (e) {
        popoverToggles.each(function () {
            if (!$(this).is(e.target) && $(this).has(e.target).length === 0 && $('.popover').has(e.target).length === 0) {
                $(this).popover("hide");
                $(".popover").each(function (i, ele) {
                    var curr = $(ele);
                    if (!curr.hasClass("in"))
                        curr.remove();
                });
            }
        });
    });
});
//# sourceMappingURL=site.js.map