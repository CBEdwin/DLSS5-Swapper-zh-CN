// Live bindings use only the supported ReShade API. Never read/patch another
// add-on's private memory or pretend that an FX uniform controls RenoDX NR.
#pragma once
#include <cmath>
#include <sstream>
#include <locale>
namespace lab_live {
using namespace reshade::api;
struct command { uint32_t epoch, id, kind; float value; };
struct binding { uint32_t kind; std::string effect, name; float min = 0, max = 1, step = .01f; };
// Resolve through scalar/callback APIs, not virtual methods returning small
// structs (MSVC and MinGW disagree on that member-function return convention).
inline effect_technique resolve_technique(effect_runtime *r, const binding &b) {
    effect_technique result = {};
    r->enumerate_techniques(b.effect.c_str(), [&](effect_runtime *rt, effect_technique t) {
        char name[128] = {}; rt->get_technique_name(t, name); if (b.name == name) result = t;
    });
    return result;
}
inline effect_uniform_variable resolve_uniform(effect_runtime *r, const binding &b) {
    effect_uniform_variable result = {};
    r->enumerate_uniform_variables(b.effect.c_str(), [&](effect_runtime *rt, effect_uniform_variable u) {
        char name[128] = {}; rt->get_uniform_variable_name(u, name); if (b.name == name) result = u;
    });
    return result;
}
inline std::string quoted(const std::string &text) {
    std::string result = "\"";
    for (unsigned char c : text) {
        if (c == '\\' || c == '"') { result += '\\'; result += c; }
        else if (c >= 32) result += c;
    }
    return result + '"';
}
struct controls {
    uint32_t epoch = 0;
    std::vector<binding> items;
    bool dirty = true;
    void discover(effect_runtime *r) {
        static uint32_t serial = 0; epoch = ++serial; items.clear(); dirty = false;
        r->enumerate_techniques(nullptr, [&](effect_runtime *rt, effect_technique t) {
            if (items.size() >= 100) return;
            char name[128] = {}, effect[128] = {}; rt->get_technique_name(t, name); rt->get_technique_effect_name(t, effect);
            items.push_back({2, effect, name, 0, 1, 1});
        });
        r->enumerate_uniform_variables(nullptr, [&](effect_runtime *rt, effect_uniform_variable u) {
            if (items.size() >= 100) return;
            format type; uint32_t rows, cols, array;
            rt->get_uniform_variable_type(u, &type, &rows, &cols, &array);
            if (rows != 1 || cols != 1 || array > 1) return;
            bool hidden = false; rt->get_annotation_bool_from_uniform_variable(u, "hidden", &hidden, 1);
            char source[128] = {}; rt->get_annotation_string_from_uniform_variable(u, "source", source);
            if (hidden || source[0]) return;
            char name[128] = {}, effect[128] = {}; rt->get_uniform_variable_name(u, name); rt->get_uniform_variable_effect_name(u, effect);
            binding b = {0, effect, name};
            if (type == format::r32_typeless) { b.kind = 1; b.step = 1; }
            else if (type == format::r32_float) {
                // Never guess a safe range. Unannotated, integer/vector and
                // special uniforms remain in the original ReShade controls.
                if (!rt->get_annotation_float_from_uniform_variable(u, "ui_min", &b.min, 1) || !rt->get_annotation_float_from_uniform_variable(u, "ui_max", &b.max, 1)) return;
                if (!std::isfinite(b.min) || !std::isfinite(b.max) || b.min >= b.max || std::abs(b.min) > 1e6f || std::abs(b.max) > 1e6f) return;
                if (!rt->get_annotation_float_from_uniform_variable(u, "ui_step", &b.step, 1) || !std::isfinite(b.step) || b.step <= 0) b.step = (b.max - b.min) / 100.f;
            } else return;
            items.push_back(b);
        });
    }
    bool apply(effect_runtime *r, command c) {
        if (dirty || c.epoch != epoch || !std::isfinite(c.value)) return false;
        if (c.id == 0) { if (c.kind != 3 || (c.value != 0 && c.value != 1)) return false; r->set_effects_state(c.value != 0); return true; }
        if (c.id > items.size()) return false;
        const auto &b = items[c.id - 1];
        if (c.kind != b.kind || c.value < b.min || c.value > b.max) return false;
        if (b.kind != 0 && c.value != 0 && c.value != 1) return false;
        if (b.kind == 2) {
            auto t = resolve_technique(r, b); if (!t.handle) return false;
            r->set_technique_state(t, c.value != 0);
        } else {
            auto u = resolve_uniform(r, b); if (!u.handle) return false;
            if (b.kind == 1) { const bool value = c.value != 0; r->set_uniform_value_bool(u, &value, 1); }
            else r->set_uniform_value_float(u, &c.value, 1);
        }
        return true;
    }
    std::string status(effect_runtime *r) const {
        std::ostringstream out; out.imbue(std::locale::classic());
        out << "{\"epoch\":" << epoch << ",\"effects\":" << (r->get_effects_state() ? "true" : "false") << ",\"tools\":[";
        for (size_t i = 0; i < items.size(); ++i) {
            const auto &b = items[i]; float value = 0; bool available = false;
            if (b.kind == 2) { auto t = resolve_technique(r, b); available = t.handle != 0; if (available) value = r->get_technique_state(t) ? 1 : 0; }
            else {
                auto u = resolve_uniform(r, b); available = u.handle != 0;
                if (available && b.kind == 0) r->get_uniform_value_float(u, &value, 1);
                else if (available) { bool v = false; r->get_uniform_value_bool(u, &v, 1); value = v ? 1 : 0; }
            }
            if (!std::isfinite(value)) { value = 0; available = false; }
            if (i) out << ',';
            out << "{\"id\":" << i + 1 << ",\"kind\":" << b.kind << ",\"effect\":" << quoted(b.effect) << ",\"name\":" << quoted(b.name)
                << ",\"min\":" << b.min << ",\"max\":" << b.max << ",\"step\":" << b.step << ",\"value\":" << value << ",\"available\":" << (available ? "true" : "false") << '}';
        }
        return out.str() + "]}";
    }
};
}
