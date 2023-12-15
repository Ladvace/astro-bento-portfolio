import { b as buildAssetsURL } from '../../renderer.mjs';
import { ref, useSSRContext, resolveComponent, mergeProps, withCtx, openBlock, createBlock, createVNode, createTextVNode, toDisplayString, reactive, Fragment, renderList, unref, computed } from 'file:///Users/andreapuglisi/Desktop/andreapuglisi.io/node_modules/vue/index.mjs';
import { ssrRenderComponent, ssrRenderAttr, ssrInterpolate, ssrRenderList, ssrRenderAttrs, ssrRenderSlot } from 'file:///Users/andreapuglisi/Desktop/andreapuglisi.io/node_modules/vue/server-renderer/index.mjs';
import { _ as _export_sfc } from './_plugin-vue_export-helper-cc2b3d55.mjs';
import moment from 'file:///Users/andreapuglisi/Desktop/andreapuglisi.io/node_modules/moment/moment.js';
import { e as useSeoMeta } from '../server.mjs';
import 'file:///Users/andreapuglisi/Desktop/andreapuglisi.io/node_modules/vue-bundle-renderer/dist/runtime.mjs';
import 'file:///Users/andreapuglisi/Desktop/andreapuglisi.io/node_modules/h3/dist/index.mjs';
import 'file:///Users/andreapuglisi/Desktop/andreapuglisi.io/node_modules/devalue/index.js';
import 'file:///Users/andreapuglisi/Desktop/andreapuglisi.io/node_modules/ufo/dist/index.mjs';
import 'file:///Users/andreapuglisi/Desktop/andreapuglisi.io/node_modules/@unhead/ssr/dist/index.mjs';
import '../../nitro/nitro-prerenderer.mjs';
import 'file:///Users/andreapuglisi/Desktop/andreapuglisi.io/node_modules/ofetch/dist/node.mjs';
import 'file:///Users/andreapuglisi/Desktop/andreapuglisi.io/node_modules/destr/dist/index.mjs';
import 'file:///Users/andreapuglisi/Desktop/andreapuglisi.io/node_modules/unenv/runtime/fetch/index.mjs';
import 'file:///Users/andreapuglisi/Desktop/andreapuglisi.io/node_modules/hookable/dist/index.mjs';
import 'file:///Users/andreapuglisi/Desktop/andreapuglisi.io/node_modules/scule/dist/index.mjs';
import 'file:///Users/andreapuglisi/Desktop/andreapuglisi.io/node_modules/klona/dist/index.mjs';
import 'file:///Users/andreapuglisi/Desktop/andreapuglisi.io/node_modules/defu/dist/defu.mjs';
import 'file:///Users/andreapuglisi/Desktop/andreapuglisi.io/node_modules/ohash/dist/index.mjs';
import 'file:///Users/andreapuglisi/Desktop/andreapuglisi.io/node_modules/unstorage/dist/index.mjs';
import 'file:///Users/andreapuglisi/Desktop/andreapuglisi.io/node_modules/unstorage/drivers/fs.mjs';
import 'file:///Users/andreapuglisi/Desktop/andreapuglisi.io/node_modules/unstorage/drivers/memory.mjs';
import 'file:///Users/andreapuglisi/Desktop/andreapuglisi.io/node_modules/unstorage/drivers/lru-cache.mjs';
import 'file:///Users/andreapuglisi/Desktop/andreapuglisi.io/node_modules/unstorage/drivers/fs-lite.mjs';
import 'file:///Users/andreapuglisi/Desktop/andreapuglisi.io/node_modules/radix3/dist/index.mjs';
import 'node:fs';
import 'node:url';
import 'file:///Users/andreapuglisi/Desktop/andreapuglisi.io/node_modules/pathe/dist/index.mjs';
import 'file:///Users/andreapuglisi/Desktop/andreapuglisi.io/node_modules/unhead/dist/index.mjs';
import 'file:///Users/andreapuglisi/Desktop/andreapuglisi.io/node_modules/@unhead/shared/dist/index.mjs';
import 'file:///Users/andreapuglisi/Desktop/andreapuglisi.io/node_modules/unctx/dist/index.mjs';
import 'file:///Users/andreapuglisi/Desktop/andreapuglisi.io/node_modules/vue-router/dist/vue-router.node.mjs';

const _sfc_main$a = {
  __name: "Card",
  __ssrInlineRender: true,
  props: {
    colSpan: String,
    rowSpan: String
  },
  setup(__props) {
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<div${ssrRenderAttrs(mergeProps({
        class: `card group overflow-hidden transform-y-[-40%] bg-darkslate-500 shadow-lg rounded-lg p-6 border border-darkslate-100 hover:border-primary-500 align-start flex-none h-full justify-start relative transform perspective-1200 w-full transition duration-75 ease-in-out col-span-1 ${__props.colSpan || "md:col-span-2"} ${__props.rowSpan || ""}`
      }, _attrs))}>`);
      ssrRenderSlot(_ctx.$slots, "default", {}, null, _push, _parent);
      _push(`</div>`);
    };
  }
};
const _sfc_setup$a = _sfc_main$a.setup;
_sfc_main$a.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("components/Card.vue");
  return _sfc_setup$a ? _sfc_setup$a(props, ctx) : void 0;
};
const __nuxt_component_0$1 = _sfc_main$a;
const _sfc_main$9 = {
  __name: "Button",
  __ssrInlineRender: true,
  props: {
    rounded: Boolean
  },
  setup(__props) {
    const props = __props;
    const buttonClasses = computed(() => {
      return `custom-btn text-xl max-h-[50px] shadow-custom active:shadow-none active:translate-x-[3px] active:translate-y-[3px] text-gray-200 px-5 py-2 border border-primary-500 hover:text-primary-500 transition-colors duration-100 ease-in-out bg-gray-900 cursor-pointer ${props.rounded ? "rounded-full" : "rounded-lg"}`;
    });
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<button${ssrRenderAttrs(mergeProps({ class: buttonClasses.value }, _attrs))}>`);
      ssrRenderSlot(_ctx.$slots, "default", {}, null, _push, _parent);
      _push(`</button>`);
    };
  }
};
const _sfc_setup$9 = _sfc_main$9.setup;
_sfc_main$9.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("components/Button.vue");
  return _sfc_setup$9 ? _sfc_setup$9(props, ctx) : void 0;
};
const __nuxt_component_1$1 = _sfc_main$9;
const _sfc_main$8 = {
  __name: "Intro",
  __ssrInlineRender: true,
  setup(__props) {
    const photoSrc = ref("me10.webp");
    const randomizeMyPhoto = () => {
      const totalImages = 17;
      const randomIndex = Math.floor(Math.random() * totalImages) + 1;
      photoSrc.value = `me${randomIndex}.webp`;
    };
    return (_ctx, _push, _parent, _attrs) => {
      const _component_Card = __nuxt_component_0$1;
      const _component_router_link = resolveComponent("router-link");
      const _component_Button = __nuxt_component_1$1;
      _push(ssrRenderComponent(_component_Card, mergeProps({
        colSpan: "md:col-span-3",
        rowSpan: "md:row-span-2"
      }, _attrs), {
        default: withCtx((_, _push2, _parent2, _scopeId) => {
          if (_push2) {
            _push2(`<div class="flex w-full h-full"${_scopeId}><div class="flex flex-col justify-between md:max-h-[300px] gap-4"${_scopeId}><div class="flex flex-col h-full"${_scopeId}><h6 class="text-sm font-light m-0 text-gray-500"${_scopeId}>Welcome <span id="wave"${_scopeId}>\u{1F44B}</span></h6><p class="m-0 font-light text-xl"${_scopeId}> Hi, I&#39;m Andrea Puglisi, a software developer specializing in both frontend and backend technologies. I have a strong focus on writing clean and reusable code, utilizing modern technology approaches. \u{1F60E} </p></div><div class="flex gap-4"${_scopeId}>`);
            _push2(ssrRenderComponent(_component_router_link, {
              to: "",
              "aria-label": "github profile",
              target: "_blank"
            }, {
              default: withCtx((_2, _push3, _parent3, _scopeId2) => {
                if (_push3) {
                  _push3(ssrRenderComponent(_component_Button, { "aria-label": "github profile" }, {
                    default: withCtx((_3, _push4, _parent4, _scopeId3) => {
                      if (_push4) {
                        _push4(`<svg class="h-6" viewBox="0 0 20 20" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" fill="#000000"${_scopeId3}><g id="SVGRepo_bgCarrier" stroke-width="0"${_scopeId3}></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"${_scopeId3}></g><g id="SVGRepo_iconCarrier"${_scopeId3}><title${_scopeId3}>github [#ffffff]</title><desc${_scopeId3}>Created with Sketch.</desc><defs${_scopeId3}></defs><g id="Page-1" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd"${_scopeId3}><g id="Dribbble-Light-Preview" transform="translate(-140.000000, -7559.000000)" fill="#ffffff"${_scopeId3}><g id="icons" transform="translate(56.000000, 160.000000)"${_scopeId3}><path d="M94,7399 C99.523,7399 104,7403.59 104,7409.253 C104,7413.782 101.138,7417.624 97.167,7418.981 C96.66,7419.082 96.48,7418.762 96.48,7418.489 C96.48,7418.151 96.492,7417.047 96.492,7415.675 C96.492,7414.719 96.172,7414.095 95.813,7413.777 C98.04,7413.523 100.38,7412.656 100.38,7408.718 C100.38,7407.598 99.992,7406.684 99.35,7405.966 C99.454,7405.707 99.797,7404.664 99.252,7403.252 C99.252,7403.252 98.414,7402.977 96.505,7404.303 C95.706,7404.076 94.85,7403.962 94,7403.958 C93.15,7403.962 92.295,7404.076 91.497,7404.303 C89.586,7402.977 88.746,7403.252 88.746,7403.252 C88.203,7404.664 88.546,7405.707 88.649,7405.966 C88.01,7406.684 87.619,7407.598 87.619,7408.718 C87.619,7412.646 89.954,7413.526 92.175,7413.785 C91.889,7414.041 91.63,7414.493 91.54,7415.156 C90.97,7415.418 89.522,7415.871 88.63,7414.304 C88.63,7414.304 88.101,7413.319 87.097,7413.247 C87.097,7413.247 86.122,7413.234 87.029,7413.87 C87.029,7413.87 87.684,7414.185 88.139,7415.37 C88.139,7415.37 88.726,7417.2 91.508,7416.58 C91.513,7417.437 91.522,7418.245 91.522,7418.489 C91.522,7418.76 91.338,7419.077 90.839,7418.982 C86.865,7417.627 84,7413.783 84,7409.253 C84,7403.59 88.478,7399 94,7399" id="github-[#ffffff]"${_scopeId3}></path></g></g></g></g></svg><span class="sr-only"${_scopeId3}>GitHub Profile</span>`);
                      } else {
                        return [
                          (openBlock(), createBlock("svg", {
                            class: "h-6",
                            viewBox: "0 0 20 20",
                            version: "1.1",
                            xmlns: "http://www.w3.org/2000/svg",
                            "xmlns:xlink": "http://www.w3.org/1999/xlink",
                            fill: "#000000"
                          }, [
                            createVNode("g", {
                              id: "SVGRepo_bgCarrier",
                              "stroke-width": "0"
                            }),
                            createVNode("g", {
                              id: "SVGRepo_tracerCarrier",
                              "stroke-linecap": "round",
                              "stroke-linejoin": "round"
                            }),
                            createVNode("g", { id: "SVGRepo_iconCarrier" }, [
                              createVNode("title", null, "github [#ffffff]"),
                              createVNode("desc", null, "Created with Sketch."),
                              createVNode("defs"),
                              createVNode("g", {
                                id: "Page-1",
                                stroke: "none",
                                "stroke-width": "1",
                                fill: "none",
                                "fill-rule": "evenodd"
                              }, [
                                createVNode("g", {
                                  id: "Dribbble-Light-Preview",
                                  transform: "translate(-140.000000, -7559.000000)",
                                  fill: "#ffffff"
                                }, [
                                  createVNode("g", {
                                    id: "icons",
                                    transform: "translate(56.000000, 160.000000)"
                                  }, [
                                    createVNode("path", {
                                      d: "M94,7399 C99.523,7399 104,7403.59 104,7409.253 C104,7413.782 101.138,7417.624 97.167,7418.981 C96.66,7419.082 96.48,7418.762 96.48,7418.489 C96.48,7418.151 96.492,7417.047 96.492,7415.675 C96.492,7414.719 96.172,7414.095 95.813,7413.777 C98.04,7413.523 100.38,7412.656 100.38,7408.718 C100.38,7407.598 99.992,7406.684 99.35,7405.966 C99.454,7405.707 99.797,7404.664 99.252,7403.252 C99.252,7403.252 98.414,7402.977 96.505,7404.303 C95.706,7404.076 94.85,7403.962 94,7403.958 C93.15,7403.962 92.295,7404.076 91.497,7404.303 C89.586,7402.977 88.746,7403.252 88.746,7403.252 C88.203,7404.664 88.546,7405.707 88.649,7405.966 C88.01,7406.684 87.619,7407.598 87.619,7408.718 C87.619,7412.646 89.954,7413.526 92.175,7413.785 C91.889,7414.041 91.63,7414.493 91.54,7415.156 C90.97,7415.418 89.522,7415.871 88.63,7414.304 C88.63,7414.304 88.101,7413.319 87.097,7413.247 C87.097,7413.247 86.122,7413.234 87.029,7413.87 C87.029,7413.87 87.684,7414.185 88.139,7415.37 C88.139,7415.37 88.726,7417.2 91.508,7416.58 C91.513,7417.437 91.522,7418.245 91.522,7418.489 C91.522,7418.76 91.338,7419.077 90.839,7418.982 C86.865,7417.627 84,7413.783 84,7409.253 C84,7403.59 88.478,7399 94,7399",
                                      id: "github-[#ffffff]"
                                    })
                                  ])
                                ])
                              ])
                            ])
                          ])),
                          createVNode("span", { class: "sr-only" }, "GitHub Profile")
                        ];
                      }
                    }),
                    _: 1
                  }, _parent3, _scopeId2));
                } else {
                  return [
                    createVNode(_component_Button, { "aria-label": "github profile" }, {
                      default: withCtx(() => [
                        (openBlock(), createBlock("svg", {
                          class: "h-6",
                          viewBox: "0 0 20 20",
                          version: "1.1",
                          xmlns: "http://www.w3.org/2000/svg",
                          "xmlns:xlink": "http://www.w3.org/1999/xlink",
                          fill: "#000000"
                        }, [
                          createVNode("g", {
                            id: "SVGRepo_bgCarrier",
                            "stroke-width": "0"
                          }),
                          createVNode("g", {
                            id: "SVGRepo_tracerCarrier",
                            "stroke-linecap": "round",
                            "stroke-linejoin": "round"
                          }),
                          createVNode("g", { id: "SVGRepo_iconCarrier" }, [
                            createVNode("title", null, "github [#ffffff]"),
                            createVNode("desc", null, "Created with Sketch."),
                            createVNode("defs"),
                            createVNode("g", {
                              id: "Page-1",
                              stroke: "none",
                              "stroke-width": "1",
                              fill: "none",
                              "fill-rule": "evenodd"
                            }, [
                              createVNode("g", {
                                id: "Dribbble-Light-Preview",
                                transform: "translate(-140.000000, -7559.000000)",
                                fill: "#ffffff"
                              }, [
                                createVNode("g", {
                                  id: "icons",
                                  transform: "translate(56.000000, 160.000000)"
                                }, [
                                  createVNode("path", {
                                    d: "M94,7399 C99.523,7399 104,7403.59 104,7409.253 C104,7413.782 101.138,7417.624 97.167,7418.981 C96.66,7419.082 96.48,7418.762 96.48,7418.489 C96.48,7418.151 96.492,7417.047 96.492,7415.675 C96.492,7414.719 96.172,7414.095 95.813,7413.777 C98.04,7413.523 100.38,7412.656 100.38,7408.718 C100.38,7407.598 99.992,7406.684 99.35,7405.966 C99.454,7405.707 99.797,7404.664 99.252,7403.252 C99.252,7403.252 98.414,7402.977 96.505,7404.303 C95.706,7404.076 94.85,7403.962 94,7403.958 C93.15,7403.962 92.295,7404.076 91.497,7404.303 C89.586,7402.977 88.746,7403.252 88.746,7403.252 C88.203,7404.664 88.546,7405.707 88.649,7405.966 C88.01,7406.684 87.619,7407.598 87.619,7408.718 C87.619,7412.646 89.954,7413.526 92.175,7413.785 C91.889,7414.041 91.63,7414.493 91.54,7415.156 C90.97,7415.418 89.522,7415.871 88.63,7414.304 C88.63,7414.304 88.101,7413.319 87.097,7413.247 C87.097,7413.247 86.122,7413.234 87.029,7413.87 C87.029,7413.87 87.684,7414.185 88.139,7415.37 C88.139,7415.37 88.726,7417.2 91.508,7416.58 C91.513,7417.437 91.522,7418.245 91.522,7418.489 C91.522,7418.76 91.338,7419.077 90.839,7418.982 C86.865,7417.627 84,7413.783 84,7409.253 C84,7403.59 88.478,7399 94,7399",
                                    id: "github-[#ffffff]"
                                  })
                                ])
                              ])
                            ])
                          ])
                        ])),
                        createVNode("span", { class: "sr-only" }, "GitHub Profile")
                      ]),
                      _: 1
                    })
                  ];
                }
              }),
              _: 1
            }, _parent2, _scopeId));
            _push2(ssrRenderComponent(_component_router_link, {
              to: "",
              "aria-label": "linkeding profile",
              target: "_blank"
            }, {
              default: withCtx((_2, _push3, _parent3, _scopeId2) => {
                if (_push3) {
                  _push3(ssrRenderComponent(_component_Button, { "aria-label": "linkedin profile" }, {
                    default: withCtx((_3, _push4, _parent4, _scopeId3) => {
                      if (_push4) {
                        _push4(`<svg class="h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"${_scopeId3}><g id="SVGRepo_bgCarrier" stroke-width="0"${_scopeId3}></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"${_scopeId3}></g><g id="SVGRepo_iconCarrier"${_scopeId3}><path d="M18.72 3.99997H5.37C5.19793 3.99191 5.02595 4.01786 4.86392 4.07635C4.70189 4.13484 4.55299 4.22471 4.42573 4.34081C4.29848 4.45692 4.19537 4.59699 4.12232 4.75299C4.04927 4.909 4.0077 5.07788 4 5.24997V18.63C4.01008 18.9901 4.15766 19.3328 4.41243 19.5875C4.6672 19.8423 5.00984 19.9899 5.37 20H18.72C19.0701 19.9844 19.4002 19.8322 19.6395 19.5761C19.8788 19.32 20.0082 18.9804 20 18.63V5.24997C20.0029 5.08247 19.9715 4.91616 19.9078 4.76122C19.8441 4.60629 19.7494 4.466 19.6295 4.34895C19.5097 4.23191 19.3672 4.14059 19.2108 4.08058C19.0544 4.02057 18.8874 3.99314 18.72 3.99997ZM9 17.34H6.67V10.21H9V17.34ZM7.89 9.12997C7.72741 9.13564 7.5654 9.10762 7.41416 9.04768C7.26291 8.98774 7.12569 8.89717 7.01113 8.78166C6.89656 8.66615 6.80711 8.5282 6.74841 8.37647C6.6897 8.22474 6.66301 8.06251 6.67 7.89997C6.66281 7.73567 6.69004 7.57169 6.74995 7.41854C6.80986 7.26538 6.90112 7.12644 7.01787 7.01063C7.13463 6.89481 7.2743 6.80468 7.42793 6.74602C7.58157 6.68735 7.74577 6.66145 7.91 6.66997C8.07259 6.66431 8.2346 6.69232 8.38584 6.75226C8.53709 6.8122 8.67431 6.90277 8.78887 7.01828C8.90344 7.13379 8.99289 7.27174 9.05159 7.42347C9.1103 7.5752 9.13699 7.73743 9.13 7.89997C9.13719 8.06427 9.10996 8.22825 9.05005 8.3814C8.99014 8.53456 8.89888 8.6735 8.78213 8.78931C8.66537 8.90513 8.5257 8.99526 8.37207 9.05392C8.21843 9.11259 8.05423 9.13849 7.89 9.12997ZM17.34 17.34H15V13.44C15 12.51 14.67 11.87 13.84 11.87C13.5822 11.8722 13.3313 11.9541 13.1219 12.1045C12.9124 12.2549 12.7546 12.4664 12.67 12.71C12.605 12.8926 12.5778 13.0865 12.59 13.28V17.34H10.29V10.21H12.59V11.21C12.7945 10.8343 13.0988 10.5225 13.4694 10.3089C13.84 10.0954 14.2624 9.98848 14.69 9.99997C16.2 9.99997 17.34 11 17.34 13.13V17.34Z" fill="#ffffff"${_scopeId3}></path></g></svg><span class="sr-only"${_scopeId3}>Linkedin Profile</span>`);
                      } else {
                        return [
                          (openBlock(), createBlock("svg", {
                            class: "h-6",
                            viewBox: "0 0 24 24",
                            fill: "none",
                            xmlns: "http://www.w3.org/2000/svg"
                          }, [
                            createVNode("g", {
                              id: "SVGRepo_bgCarrier",
                              "stroke-width": "0"
                            }),
                            createVNode("g", {
                              id: "SVGRepo_tracerCarrier",
                              "stroke-linecap": "round",
                              "stroke-linejoin": "round"
                            }),
                            createVNode("g", { id: "SVGRepo_iconCarrier" }, [
                              createVNode("path", {
                                d: "M18.72 3.99997H5.37C5.19793 3.99191 5.02595 4.01786 4.86392 4.07635C4.70189 4.13484 4.55299 4.22471 4.42573 4.34081C4.29848 4.45692 4.19537 4.59699 4.12232 4.75299C4.04927 4.909 4.0077 5.07788 4 5.24997V18.63C4.01008 18.9901 4.15766 19.3328 4.41243 19.5875C4.6672 19.8423 5.00984 19.9899 5.37 20H18.72C19.0701 19.9844 19.4002 19.8322 19.6395 19.5761C19.8788 19.32 20.0082 18.9804 20 18.63V5.24997C20.0029 5.08247 19.9715 4.91616 19.9078 4.76122C19.8441 4.60629 19.7494 4.466 19.6295 4.34895C19.5097 4.23191 19.3672 4.14059 19.2108 4.08058C19.0544 4.02057 18.8874 3.99314 18.72 3.99997ZM9 17.34H6.67V10.21H9V17.34ZM7.89 9.12997C7.72741 9.13564 7.5654 9.10762 7.41416 9.04768C7.26291 8.98774 7.12569 8.89717 7.01113 8.78166C6.89656 8.66615 6.80711 8.5282 6.74841 8.37647C6.6897 8.22474 6.66301 8.06251 6.67 7.89997C6.66281 7.73567 6.69004 7.57169 6.74995 7.41854C6.80986 7.26538 6.90112 7.12644 7.01787 7.01063C7.13463 6.89481 7.2743 6.80468 7.42793 6.74602C7.58157 6.68735 7.74577 6.66145 7.91 6.66997C8.07259 6.66431 8.2346 6.69232 8.38584 6.75226C8.53709 6.8122 8.67431 6.90277 8.78887 7.01828C8.90344 7.13379 8.99289 7.27174 9.05159 7.42347C9.1103 7.5752 9.13699 7.73743 9.13 7.89997C9.13719 8.06427 9.10996 8.22825 9.05005 8.3814C8.99014 8.53456 8.89888 8.6735 8.78213 8.78931C8.66537 8.90513 8.5257 8.99526 8.37207 9.05392C8.21843 9.11259 8.05423 9.13849 7.89 9.12997ZM17.34 17.34H15V13.44C15 12.51 14.67 11.87 13.84 11.87C13.5822 11.8722 13.3313 11.9541 13.1219 12.1045C12.9124 12.2549 12.7546 12.4664 12.67 12.71C12.605 12.8926 12.5778 13.0865 12.59 13.28V17.34H10.29V10.21H12.59V11.21C12.7945 10.8343 13.0988 10.5225 13.4694 10.3089C13.84 10.0954 14.2624 9.98848 14.69 9.99997C16.2 9.99997 17.34 11 17.34 13.13V17.34Z",
                                fill: "#ffffff"
                              })
                            ])
                          ])),
                          createVNode("span", { class: "sr-only" }, "Linkedin Profile")
                        ];
                      }
                    }),
                    _: 1
                  }, _parent3, _scopeId2));
                } else {
                  return [
                    createVNode(_component_Button, { "aria-label": "linkedin profile" }, {
                      default: withCtx(() => [
                        (openBlock(), createBlock("svg", {
                          class: "h-6",
                          viewBox: "0 0 24 24",
                          fill: "none",
                          xmlns: "http://www.w3.org/2000/svg"
                        }, [
                          createVNode("g", {
                            id: "SVGRepo_bgCarrier",
                            "stroke-width": "0"
                          }),
                          createVNode("g", {
                            id: "SVGRepo_tracerCarrier",
                            "stroke-linecap": "round",
                            "stroke-linejoin": "round"
                          }),
                          createVNode("g", { id: "SVGRepo_iconCarrier" }, [
                            createVNode("path", {
                              d: "M18.72 3.99997H5.37C5.19793 3.99191 5.02595 4.01786 4.86392 4.07635C4.70189 4.13484 4.55299 4.22471 4.42573 4.34081C4.29848 4.45692 4.19537 4.59699 4.12232 4.75299C4.04927 4.909 4.0077 5.07788 4 5.24997V18.63C4.01008 18.9901 4.15766 19.3328 4.41243 19.5875C4.6672 19.8423 5.00984 19.9899 5.37 20H18.72C19.0701 19.9844 19.4002 19.8322 19.6395 19.5761C19.8788 19.32 20.0082 18.9804 20 18.63V5.24997C20.0029 5.08247 19.9715 4.91616 19.9078 4.76122C19.8441 4.60629 19.7494 4.466 19.6295 4.34895C19.5097 4.23191 19.3672 4.14059 19.2108 4.08058C19.0544 4.02057 18.8874 3.99314 18.72 3.99997ZM9 17.34H6.67V10.21H9V17.34ZM7.89 9.12997C7.72741 9.13564 7.5654 9.10762 7.41416 9.04768C7.26291 8.98774 7.12569 8.89717 7.01113 8.78166C6.89656 8.66615 6.80711 8.5282 6.74841 8.37647C6.6897 8.22474 6.66301 8.06251 6.67 7.89997C6.66281 7.73567 6.69004 7.57169 6.74995 7.41854C6.80986 7.26538 6.90112 7.12644 7.01787 7.01063C7.13463 6.89481 7.2743 6.80468 7.42793 6.74602C7.58157 6.68735 7.74577 6.66145 7.91 6.66997C8.07259 6.66431 8.2346 6.69232 8.38584 6.75226C8.53709 6.8122 8.67431 6.90277 8.78887 7.01828C8.90344 7.13379 8.99289 7.27174 9.05159 7.42347C9.1103 7.5752 9.13699 7.73743 9.13 7.89997C9.13719 8.06427 9.10996 8.22825 9.05005 8.3814C8.99014 8.53456 8.89888 8.6735 8.78213 8.78931C8.66537 8.90513 8.5257 8.99526 8.37207 9.05392C8.21843 9.11259 8.05423 9.13849 7.89 9.12997ZM17.34 17.34H15V13.44C15 12.51 14.67 11.87 13.84 11.87C13.5822 11.8722 13.3313 11.9541 13.1219 12.1045C12.9124 12.2549 12.7546 12.4664 12.67 12.71C12.605 12.8926 12.5778 13.0865 12.59 13.28V17.34H10.29V10.21H12.59V11.21C12.7945 10.8343 13.0988 10.5225 13.4694 10.3089C13.84 10.0954 14.2624 9.98848 14.69 9.99997C16.2 9.99997 17.34 11 17.34 13.13V17.34Z",
                              fill: "#ffffff"
                            })
                          ])
                        ])),
                        createVNode("span", { class: "sr-only" }, "Linkedin Profile")
                      ]),
                      _: 1
                    })
                  ];
                }
              }),
              _: 1
            }, _parent2, _scopeId));
            _push2(ssrRenderComponent(_component_Button, {
              "aria-label": "easter-egg",
              onClick: randomizeMyPhoto
            }, {
              default: withCtx((_2, _push3, _parent3, _scopeId2) => {
                if (_push3) {
                  _push3(`<svg class="h-6 vibrate" fill="#fff" version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 512 512" xml:space="preserve" stroke="#fff"${_scopeId2}><g id="SVGRepo_bgCarrier" stroke-width="0"${_scopeId2}></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"${_scopeId2}></g><g id="SVGRepo_iconCarrier"${_scopeId2}><g${_scopeId2}><g${_scopeId2}><path d="M256.42,307.849l-38.155-16.958l14.948-29.896l22.369,9.942l89.462-44.733l105.587,52.794 c-1.796-67.876-21.157-131.512-54.999-180.159C358.783,45.867,309.195,16.696,256,16.696S153.217,45.867,116.369,98.837 C82.8,147.092,63.476,210.091,61.411,277.35l93.659-51.088l47.598,21.154l-14.949,29.896l-31.138-13.84l-93.892,51.214 C74.522,416.339,156.698,495.304,256,495.304c99,0,180.985-78.484,193.21-179.685l-104.166-52.083L256.42,307.849z"${_scopeId2}></path></g></g><g${_scopeId2}><g${_scopeId2}><rect y="128" width="55.652" height="33.391"${_scopeId2}></rect></g></g><g${_scopeId2}><g${_scopeId2}><rect x="24.183" y="40.811" transform="matrix(0.3333 -0.9428 0.9428 0.3333 -37.458 84.2994)" width="33.391" height="55.65"${_scopeId2}></rect></g></g><g${_scopeId2}><g${_scopeId2}><rect x="456.348" y="128" width="55.652" height="33.391"${_scopeId2}></rect></g></g><g${_scopeId2}><g${_scopeId2}><rect x="443.282" y="51.937" transform="matrix(0.9428 -0.3333 0.3333 0.9428 4.0631 160.9478)" width="55.65" height="33.391"${_scopeId2}></rect></g></g></g></svg><span class="sr-only"${_scopeId2}>Easter Egg</span>`);
                } else {
                  return [
                    (openBlock(), createBlock("svg", {
                      class: "h-6 vibrate",
                      fill: "#fff",
                      version: "1.1",
                      id: "Layer_1",
                      xmlns: "http://www.w3.org/2000/svg",
                      "xmlns:xlink": "http://www.w3.org/1999/xlink",
                      viewBox: "0 0 512 512",
                      "xml:space": "preserve",
                      stroke: "#fff"
                    }, [
                      createVNode("g", {
                        id: "SVGRepo_bgCarrier",
                        "stroke-width": "0"
                      }),
                      createVNode("g", {
                        id: "SVGRepo_tracerCarrier",
                        "stroke-linecap": "round",
                        "stroke-linejoin": "round"
                      }),
                      createVNode("g", { id: "SVGRepo_iconCarrier" }, [
                        createVNode("g", null, [
                          createVNode("g", null, [
                            createVNode("path", { d: "M256.42,307.849l-38.155-16.958l14.948-29.896l22.369,9.942l89.462-44.733l105.587,52.794 c-1.796-67.876-21.157-131.512-54.999-180.159C358.783,45.867,309.195,16.696,256,16.696S153.217,45.867,116.369,98.837 C82.8,147.092,63.476,210.091,61.411,277.35l93.659-51.088l47.598,21.154l-14.949,29.896l-31.138-13.84l-93.892,51.214 C74.522,416.339,156.698,495.304,256,495.304c99,0,180.985-78.484,193.21-179.685l-104.166-52.083L256.42,307.849z" })
                          ])
                        ]),
                        createVNode("g", null, [
                          createVNode("g", null, [
                            createVNode("rect", {
                              y: "128",
                              width: "55.652",
                              height: "33.391"
                            })
                          ])
                        ]),
                        createVNode("g", null, [
                          createVNode("g", null, [
                            createVNode("rect", {
                              x: "24.183",
                              y: "40.811",
                              transform: "matrix(0.3333 -0.9428 0.9428 0.3333 -37.458 84.2994)",
                              width: "33.391",
                              height: "55.65"
                            })
                          ])
                        ]),
                        createVNode("g", null, [
                          createVNode("g", null, [
                            createVNode("rect", {
                              x: "456.348",
                              y: "128",
                              width: "55.652",
                              height: "33.391"
                            })
                          ])
                        ]),
                        createVNode("g", null, [
                          createVNode("g", null, [
                            createVNode("rect", {
                              x: "443.282",
                              y: "51.937",
                              transform: "matrix(0.9428 -0.3333 0.3333 0.9428 4.0631 160.9478)",
                              width: "55.65",
                              height: "33.391"
                            })
                          ])
                        ])
                      ])
                    ])),
                    createVNode("span", { class: "sr-only" }, "Easter Egg")
                  ];
                }
              }),
              _: 1
            }, _parent2, _scopeId));
            _push2(`</div></div><img width="300" height="300"${ssrRenderAttr("src", "./me/" + photoSrc.value)} class="w-auto max-h-[300px] select-none absolute right-[-110px] bottom-[-20px] z-[-1] opacity-50 md:opacity-100 md:relative md:right-auto md:bottom-auto md:z-auto pointer-events-none" alt="memoji of andrea"${_scopeId}></div>`);
          } else {
            return [
              createVNode("div", { class: "flex w-full h-full" }, [
                createVNode("div", { class: "flex flex-col justify-between md:max-h-[300px] gap-4" }, [
                  createVNode("div", { class: "flex flex-col h-full" }, [
                    createVNode("h6", { class: "text-sm font-light m-0 text-gray-500" }, [
                      createTextVNode("Welcome "),
                      createVNode("span", { id: "wave" }, "\u{1F44B}")
                    ]),
                    createVNode("p", { class: "m-0 font-light text-xl" }, " Hi, I'm Andrea Puglisi, a software developer specializing in both frontend and backend technologies. I have a strong focus on writing clean and reusable code, utilizing modern technology approaches. \u{1F60E} ")
                  ]),
                  createVNode("div", { class: "flex gap-4" }, [
                    createVNode(_component_router_link, {
                      to: "",
                      "aria-label": "github profile",
                      target: "_blank"
                    }, {
                      default: withCtx(() => [
                        createVNode(_component_Button, { "aria-label": "github profile" }, {
                          default: withCtx(() => [
                            (openBlock(), createBlock("svg", {
                              class: "h-6",
                              viewBox: "0 0 20 20",
                              version: "1.1",
                              xmlns: "http://www.w3.org/2000/svg",
                              "xmlns:xlink": "http://www.w3.org/1999/xlink",
                              fill: "#000000"
                            }, [
                              createVNode("g", {
                                id: "SVGRepo_bgCarrier",
                                "stroke-width": "0"
                              }),
                              createVNode("g", {
                                id: "SVGRepo_tracerCarrier",
                                "stroke-linecap": "round",
                                "stroke-linejoin": "round"
                              }),
                              createVNode("g", { id: "SVGRepo_iconCarrier" }, [
                                createVNode("title", null, "github [#ffffff]"),
                                createVNode("desc", null, "Created with Sketch."),
                                createVNode("defs"),
                                createVNode("g", {
                                  id: "Page-1",
                                  stroke: "none",
                                  "stroke-width": "1",
                                  fill: "none",
                                  "fill-rule": "evenodd"
                                }, [
                                  createVNode("g", {
                                    id: "Dribbble-Light-Preview",
                                    transform: "translate(-140.000000, -7559.000000)",
                                    fill: "#ffffff"
                                  }, [
                                    createVNode("g", {
                                      id: "icons",
                                      transform: "translate(56.000000, 160.000000)"
                                    }, [
                                      createVNode("path", {
                                        d: "M94,7399 C99.523,7399 104,7403.59 104,7409.253 C104,7413.782 101.138,7417.624 97.167,7418.981 C96.66,7419.082 96.48,7418.762 96.48,7418.489 C96.48,7418.151 96.492,7417.047 96.492,7415.675 C96.492,7414.719 96.172,7414.095 95.813,7413.777 C98.04,7413.523 100.38,7412.656 100.38,7408.718 C100.38,7407.598 99.992,7406.684 99.35,7405.966 C99.454,7405.707 99.797,7404.664 99.252,7403.252 C99.252,7403.252 98.414,7402.977 96.505,7404.303 C95.706,7404.076 94.85,7403.962 94,7403.958 C93.15,7403.962 92.295,7404.076 91.497,7404.303 C89.586,7402.977 88.746,7403.252 88.746,7403.252 C88.203,7404.664 88.546,7405.707 88.649,7405.966 C88.01,7406.684 87.619,7407.598 87.619,7408.718 C87.619,7412.646 89.954,7413.526 92.175,7413.785 C91.889,7414.041 91.63,7414.493 91.54,7415.156 C90.97,7415.418 89.522,7415.871 88.63,7414.304 C88.63,7414.304 88.101,7413.319 87.097,7413.247 C87.097,7413.247 86.122,7413.234 87.029,7413.87 C87.029,7413.87 87.684,7414.185 88.139,7415.37 C88.139,7415.37 88.726,7417.2 91.508,7416.58 C91.513,7417.437 91.522,7418.245 91.522,7418.489 C91.522,7418.76 91.338,7419.077 90.839,7418.982 C86.865,7417.627 84,7413.783 84,7409.253 C84,7403.59 88.478,7399 94,7399",
                                        id: "github-[#ffffff]"
                                      })
                                    ])
                                  ])
                                ])
                              ])
                            ])),
                            createVNode("span", { class: "sr-only" }, "GitHub Profile")
                          ]),
                          _: 1
                        })
                      ]),
                      _: 1
                    }),
                    createVNode(_component_router_link, {
                      to: "",
                      "aria-label": "linkeding profile",
                      target: "_blank"
                    }, {
                      default: withCtx(() => [
                        createVNode(_component_Button, { "aria-label": "linkedin profile" }, {
                          default: withCtx(() => [
                            (openBlock(), createBlock("svg", {
                              class: "h-6",
                              viewBox: "0 0 24 24",
                              fill: "none",
                              xmlns: "http://www.w3.org/2000/svg"
                            }, [
                              createVNode("g", {
                                id: "SVGRepo_bgCarrier",
                                "stroke-width": "0"
                              }),
                              createVNode("g", {
                                id: "SVGRepo_tracerCarrier",
                                "stroke-linecap": "round",
                                "stroke-linejoin": "round"
                              }),
                              createVNode("g", { id: "SVGRepo_iconCarrier" }, [
                                createVNode("path", {
                                  d: "M18.72 3.99997H5.37C5.19793 3.99191 5.02595 4.01786 4.86392 4.07635C4.70189 4.13484 4.55299 4.22471 4.42573 4.34081C4.29848 4.45692 4.19537 4.59699 4.12232 4.75299C4.04927 4.909 4.0077 5.07788 4 5.24997V18.63C4.01008 18.9901 4.15766 19.3328 4.41243 19.5875C4.6672 19.8423 5.00984 19.9899 5.37 20H18.72C19.0701 19.9844 19.4002 19.8322 19.6395 19.5761C19.8788 19.32 20.0082 18.9804 20 18.63V5.24997C20.0029 5.08247 19.9715 4.91616 19.9078 4.76122C19.8441 4.60629 19.7494 4.466 19.6295 4.34895C19.5097 4.23191 19.3672 4.14059 19.2108 4.08058C19.0544 4.02057 18.8874 3.99314 18.72 3.99997ZM9 17.34H6.67V10.21H9V17.34ZM7.89 9.12997C7.72741 9.13564 7.5654 9.10762 7.41416 9.04768C7.26291 8.98774 7.12569 8.89717 7.01113 8.78166C6.89656 8.66615 6.80711 8.5282 6.74841 8.37647C6.6897 8.22474 6.66301 8.06251 6.67 7.89997C6.66281 7.73567 6.69004 7.57169 6.74995 7.41854C6.80986 7.26538 6.90112 7.12644 7.01787 7.01063C7.13463 6.89481 7.2743 6.80468 7.42793 6.74602C7.58157 6.68735 7.74577 6.66145 7.91 6.66997C8.07259 6.66431 8.2346 6.69232 8.38584 6.75226C8.53709 6.8122 8.67431 6.90277 8.78887 7.01828C8.90344 7.13379 8.99289 7.27174 9.05159 7.42347C9.1103 7.5752 9.13699 7.73743 9.13 7.89997C9.13719 8.06427 9.10996 8.22825 9.05005 8.3814C8.99014 8.53456 8.89888 8.6735 8.78213 8.78931C8.66537 8.90513 8.5257 8.99526 8.37207 9.05392C8.21843 9.11259 8.05423 9.13849 7.89 9.12997ZM17.34 17.34H15V13.44C15 12.51 14.67 11.87 13.84 11.87C13.5822 11.8722 13.3313 11.9541 13.1219 12.1045C12.9124 12.2549 12.7546 12.4664 12.67 12.71C12.605 12.8926 12.5778 13.0865 12.59 13.28V17.34H10.29V10.21H12.59V11.21C12.7945 10.8343 13.0988 10.5225 13.4694 10.3089C13.84 10.0954 14.2624 9.98848 14.69 9.99997C16.2 9.99997 17.34 11 17.34 13.13V17.34Z",
                                  fill: "#ffffff"
                                })
                              ])
                            ])),
                            createVNode("span", { class: "sr-only" }, "Linkedin Profile")
                          ]),
                          _: 1
                        })
                      ]),
                      _: 1
                    }),
                    createVNode(_component_Button, {
                      "aria-label": "easter-egg",
                      onClick: randomizeMyPhoto
                    }, {
                      default: withCtx(() => [
                        (openBlock(), createBlock("svg", {
                          class: "h-6 vibrate",
                          fill: "#fff",
                          version: "1.1",
                          id: "Layer_1",
                          xmlns: "http://www.w3.org/2000/svg",
                          "xmlns:xlink": "http://www.w3.org/1999/xlink",
                          viewBox: "0 0 512 512",
                          "xml:space": "preserve",
                          stroke: "#fff"
                        }, [
                          createVNode("g", {
                            id: "SVGRepo_bgCarrier",
                            "stroke-width": "0"
                          }),
                          createVNode("g", {
                            id: "SVGRepo_tracerCarrier",
                            "stroke-linecap": "round",
                            "stroke-linejoin": "round"
                          }),
                          createVNode("g", { id: "SVGRepo_iconCarrier" }, [
                            createVNode("g", null, [
                              createVNode("g", null, [
                                createVNode("path", { d: "M256.42,307.849l-38.155-16.958l14.948-29.896l22.369,9.942l89.462-44.733l105.587,52.794 c-1.796-67.876-21.157-131.512-54.999-180.159C358.783,45.867,309.195,16.696,256,16.696S153.217,45.867,116.369,98.837 C82.8,147.092,63.476,210.091,61.411,277.35l93.659-51.088l47.598,21.154l-14.949,29.896l-31.138-13.84l-93.892,51.214 C74.522,416.339,156.698,495.304,256,495.304c99,0,180.985-78.484,193.21-179.685l-104.166-52.083L256.42,307.849z" })
                              ])
                            ]),
                            createVNode("g", null, [
                              createVNode("g", null, [
                                createVNode("rect", {
                                  y: "128",
                                  width: "55.652",
                                  height: "33.391"
                                })
                              ])
                            ]),
                            createVNode("g", null, [
                              createVNode("g", null, [
                                createVNode("rect", {
                                  x: "24.183",
                                  y: "40.811",
                                  transform: "matrix(0.3333 -0.9428 0.9428 0.3333 -37.458 84.2994)",
                                  width: "33.391",
                                  height: "55.65"
                                })
                              ])
                            ]),
                            createVNode("g", null, [
                              createVNode("g", null, [
                                createVNode("rect", {
                                  x: "456.348",
                                  y: "128",
                                  width: "55.652",
                                  height: "33.391"
                                })
                              ])
                            ]),
                            createVNode("g", null, [
                              createVNode("g", null, [
                                createVNode("rect", {
                                  x: "443.282",
                                  y: "51.937",
                                  transform: "matrix(0.9428 -0.3333 0.3333 0.9428 4.0631 160.9478)",
                                  width: "55.65",
                                  height: "33.391"
                                })
                              ])
                            ])
                          ])
                        ])),
                        createVNode("span", { class: "sr-only" }, "Easter Egg")
                      ]),
                      _: 1
                    })
                  ])
                ]),
                createVNode("img", {
                  width: "300",
                  height: "300",
                  src: "./me/" + photoSrc.value,
                  class: "w-auto max-h-[300px] select-none absolute right-[-110px] bottom-[-20px] z-[-1] opacity-50 md:opacity-100 md:relative md:right-auto md:bottom-auto md:z-auto pointer-events-none",
                  alt: "memoji of andrea"
                }, null, 8, ["src"])
              ])
            ];
          }
        }),
        _: 1
      }, _parent));
    };
  }
};
const _sfc_setup$8 = _sfc_main$8.setup;
_sfc_main$8.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("components/Intro.vue");
  return _sfc_setup$8 ? _sfc_setup$8(props, ctx) : void 0;
};
const __nuxt_component_0 = _sfc_main$8;
const _sfc_main$7 = {};
function _sfc_ssrRender$2(_ctx, _push, _parent, _attrs) {
  const _component_Card = __nuxt_component_0$1;
  _push(ssrRenderComponent(_component_Card, mergeProps({
    colSpan: "md:col-span-1",
    rowSpan: "md:row-span-4"
  }, _attrs), {
    default: withCtx((_, _push2, _parent2, _scopeId) => {
      if (_push2) {
        _push2(`<div class="flex flex-col gap-2"${_scopeId}><h2 class="text-xl font-bold m-0 z-20"${_scopeId}>About me</h2><p class="text-sm font-light"${_scopeId}> Hi, I&#39;m Andrea, a front-end &amp;&amp; back-end software developer from Italy. <br${_scopeId}></p><p class="text-sm font-light"${_scopeId}> Primary Toolbox: </p><ul class="list-disc list-inside"${_scopeId}><li${_scopeId}>JavaScript | PHP \u26A1\uFE0F</li><li${_scopeId}>Vue | Nuxt | Pinia \u{1F60C}</li><li${_scopeId}>Tailwind | Bootstrap 5 \u{1F485}</li><li${_scopeId}>Directus \u{1F430}</li><li${_scopeId}>Laravel \u{1F6E0}\uFE0F</li><li${_scopeId}>Wordpress \u{1F9DC}</li><li${_scopeId}>Plesk | CPanel \u2699\uFE0F</li><li${_scopeId}>CloudLinux | OSX \u{1F4BB}</li></ul><p class="text-sm font-light"${_scopeId}> While these technologies are for my daily development adventures, my skills doesn&#39;t stop there. </p><p class="text-sm font-light"${_scopeId}> Each day is a new opportunity to enhance my skills and propel myself forward in the ever-evolving tech landscape. I love discovering new insights and techniques that sparkle innovation in my work. \u2728 </p></div>`);
      } else {
        return [
          createVNode("div", { class: "flex flex-col gap-2" }, [
            createVNode("h2", { class: "text-xl font-bold m-0 z-20" }, "About me"),
            createVNode("p", { class: "text-sm font-light" }, [
              createTextVNode(" Hi, I'm Andrea, a front-end && back-end software developer from Italy. "),
              createVNode("br")
            ]),
            createVNode("p", { class: "text-sm font-light" }, " Primary Toolbox: "),
            createVNode("ul", { class: "list-disc list-inside" }, [
              createVNode("li", null, "JavaScript | PHP \u26A1\uFE0F"),
              createVNode("li", null, "Vue | Nuxt | Pinia \u{1F60C}"),
              createVNode("li", null, "Tailwind | Bootstrap 5 \u{1F485}"),
              createVNode("li", null, "Directus \u{1F430}"),
              createVNode("li", null, "Laravel \u{1F6E0}\uFE0F"),
              createVNode("li", null, "Wordpress \u{1F9DC}"),
              createVNode("li", null, "Plesk | CPanel \u2699\uFE0F"),
              createVNode("li", null, "CloudLinux | OSX \u{1F4BB}")
            ]),
            createVNode("p", { class: "text-sm font-light" }, " While these technologies are for my daily development adventures, my skills doesn't stop there. "),
            createVNode("p", { class: "text-sm font-light" }, " Each day is a new opportunity to enhance my skills and propel myself forward in the ever-evolving tech landscape. I love discovering new insights and techniques that sparkle innovation in my work. \u2728 ")
          ])
        ];
      }
    }),
    _: 1
  }, _parent));
}
const _sfc_setup$7 = _sfc_main$7.setup;
_sfc_main$7.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("components/About.vue");
  return _sfc_setup$7 ? _sfc_setup$7(props, ctx) : void 0;
};
const __nuxt_component_1 = /* @__PURE__ */ _export_sfc(_sfc_main$7, [["ssrRender", _sfc_ssrRender$2]]);
const _sfc_main$6 = {};
function _sfc_ssrRender$1(_ctx, _push, _parent, _attrs) {
  const _component_Card = __nuxt_component_0$1;
  _push(ssrRenderComponent(_component_Card, mergeProps({
    colSpan: "md:col-span-1",
    rowSpan: "md:row-span-4"
  }, _attrs), {
    default: withCtx((_, _push2, _parent2, _scopeId) => {
      if (_push2) {
        _push2(`<div class="h-full"${_scopeId}><header class="flex items-center"${_scopeId}><h1 class="text-white text-xl font-bold"${_scopeId}> Let&#39;s chat together! </h1></header><div class="flex flex-col mt-4"${_scopeId}><h2 class="text-gray-500"${_scopeId}>Contact</h2><p${_scopeId}>\u{1F40C} info@andreapuglisi.io</p><p${_scopeId}>\u{1F4F2} +39 331 149 58 34</p><p${_scopeId}>\u{1F4CD} Ragusa, Italy</p></div><div class="flex flex-col mt-4 w-fit"${_scopeId}><h2 class="text-gray-500"${_scopeId}>Social Network</h2><ul${_scopeId}><li${_scopeId}><a href="https://www.instagram.com/andreapuglisi" target="_blank"${_scopeId}>Instagram</a></li><li${_scopeId}><a href="https://www.facebook.com/andrea.puglisi.95/" target="_blank"${_scopeId}>Facebook</a></li><li${_scopeId}><a href="https://www.linkedin.com/in/andrea-puglisi-9046a255/" target="_blank"${_scopeId}>LinkedIn</a></li><li${_scopeId}><a href="https://github.com/apdev95" target="_blank"${_scopeId}>GitHub</a></li></ul></div></div>`);
      } else {
        return [
          createVNode("div", { class: "h-full" }, [
            createVNode("header", { class: "flex items-center" }, [
              createVNode("h1", { class: "text-white text-xl font-bold" }, " Let's chat together! ")
            ]),
            createVNode("div", { class: "flex flex-col mt-4" }, [
              createVNode("h2", { class: "text-gray-500" }, "Contact"),
              createVNode("p", null, "\u{1F40C} info@andreapuglisi.io"),
              createVNode("p", null, "\u{1F4F2} +39 331 149 58 34"),
              createVNode("p", null, "\u{1F4CD} Ragusa, Italy")
            ]),
            createVNode("div", { class: "flex flex-col mt-4 w-fit" }, [
              createVNode("h2", { class: "text-gray-500" }, "Social Network"),
              createVNode("ul", null, [
                createVNode("li", null, [
                  createVNode("a", {
                    href: "https://www.instagram.com/andreapuglisi",
                    target: "_blank"
                  }, "Instagram")
                ]),
                createVNode("li", null, [
                  createVNode("a", {
                    href: "https://www.facebook.com/andrea.puglisi.95/",
                    target: "_blank"
                  }, "Facebook")
                ]),
                createVNode("li", null, [
                  createVNode("a", {
                    href: "https://www.linkedin.com/in/andrea-puglisi-9046a255/",
                    target: "_blank"
                  }, "LinkedIn")
                ]),
                createVNode("li", null, [
                  createVNode("a", {
                    href: "https://github.com/apdev95",
                    target: "_blank"
                  }, "GitHub")
                ])
              ])
            ])
          ])
        ];
      }
    }),
    _: 1
  }, _parent));
}
const _sfc_setup$6 = _sfc_main$6.setup;
_sfc_main$6.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("components/Contact.vue");
  return _sfc_setup$6 ? _sfc_setup$6(props, ctx) : void 0;
};
const __nuxt_component_2 = /* @__PURE__ */ _export_sfc(_sfc_main$6, [["ssrRender", _sfc_ssrRender$1]]);
const _sfc_main$5 = {
  __name: "TimeZone",
  __ssrInlineRender: true,
  setup(__props) {
    const currentDateTime = ref(moment().format("h:mm:ss A [CET]"));
    setInterval(() => {
      currentDateTime.value = moment().format("h:mm:ss A [CET]");
    }, 1e3);
    return (_ctx, _push, _parent, _attrs) => {
      _push(ssrRenderComponent(__nuxt_component_0$1, mergeProps({
        colSpan: "lg:col-span-2",
        rowSpan: "md:row-span-1",
        title: "Time zone"
      }, _attrs), {
        default: withCtx((_, _push2, _parent2, _scopeId) => {
          if (_push2) {
            _push2(`<h2 class="text-xl font-bold"${_scopeId}>Time zone</h2><p id="timeDisplay" class="text-2xl xl:text-5xl w-50 xl:w-100 h-[calc(100%-28px)] font-serif flex justify-left items-center"${_scopeId}>${ssrInterpolate(currentDateTime.value)}</p>`);
          } else {
            return [
              createVNode("h2", { class: "text-xl font-bold" }, "Time zone"),
              createVNode("p", {
                id: "timeDisplay",
                class: "text-2xl xl:text-5xl w-50 xl:w-100 h-[calc(100%-28px)] font-serif flex justify-left items-center"
              }, toDisplayString(currentDateTime.value), 1)
            ];
          }
        }),
        _: 1
      }, _parent));
    };
  }
};
const _sfc_setup$5 = _sfc_main$5.setup;
_sfc_main$5.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("components/TimeZone.vue");
  return _sfc_setup$5 ? _sfc_setup$5(props, ctx) : void 0;
};
const __nuxt_component_3 = _sfc_main$5;
const _sfc_main$4 = {
  __name: "Blog",
  __ssrInlineRender: true,
  setup(__props) {
    const posts = reactive([
      "Vue + Pinia made simple",
      "Vue + Nuxt made simple",
      "How to port a project from another Framework"
    ]);
    return (_ctx, _push, _parent, _attrs) => {
      const _component_Card = __nuxt_component_0$1;
      const _component_router_link = resolveComponent("router-link");
      _push(ssrRenderComponent(_component_Card, mergeProps({
        colSpan: "md:col-span-1",
        rowSpan: "md:row-span-3",
        href: "/"
      }, _attrs), {
        default: withCtx((_, _push2, _parent2, _scopeId) => {
          if (_push2) {
            _push2(`<h2 class="text-xl font-bold m-0 z-20"${_scopeId}>Blog</h2><p class="text-xs text-gray-500 mb-1"${_scopeId}>Latest from the blog</p><!--[-->`);
            ssrRenderList(posts, (post, index) => {
              _push2(`<p class="text-sm font-light text-base hover:text-red-500"${_scopeId}>`);
              _push2(ssrRenderComponent(_component_router_link, { to: "/" }, {
                default: withCtx((_2, _push3, _parent3, _scopeId2) => {
                  if (_push3) {
                    _push3(` - ${ssrInterpolate(post)}`);
                  } else {
                    return [
                      createTextVNode(" - " + toDisplayString(post), 1)
                    ];
                  }
                }),
                _: 2
              }, _parent2, _scopeId));
              _push2(`</p>`);
            });
            _push2(`<!--]-->`);
          } else {
            return [
              createVNode("h2", { class: "text-xl font-bold m-0 z-20" }, "Blog"),
              createVNode("p", { class: "text-xs text-gray-500 mb-1" }, "Latest from the blog"),
              (openBlock(true), createBlock(Fragment, null, renderList(posts, (post, index) => {
                return openBlock(), createBlock("p", {
                  class: "text-sm font-light text-base hover:text-red-500",
                  key: index
                }, [
                  createVNode(_component_router_link, { to: "/" }, {
                    default: withCtx(() => [
                      createTextVNode(" - " + toDisplayString(post), 1)
                    ]),
                    _: 2
                  }, 1024)
                ]);
              }), 128))
            ];
          }
        }),
        _: 1
      }, _parent));
    };
  }
};
const _sfc_setup$4 = _sfc_main$4.setup;
_sfc_main$4.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("components/Blog.vue");
  return _sfc_setup$4 ? _sfc_setup$4(props, ctx) : void 0;
};
const __nuxt_component_4 = _sfc_main$4;
const _imports_0 = "" + buildAssetsURL("mdrg.6c05bdb4.jpg");
const _sfc_main$3 = {
  __name: "CurrentWeather",
  __ssrInlineRender: true,
  setup(__props) {
    const current_weather = reactive({
      loaded: false,
      now: {
        data: "",
        icon: ""
      }
    });
    return (_ctx, _push, _parent, _attrs) => {
      const _component_Card = __nuxt_component_0$1;
      _push(ssrRenderComponent(_component_Card, mergeProps({
        colSpan: "md:col-span-1",
        rowSpan: "md:row-span-1"
      }, _attrs), {
        default: withCtx((_, _push2, _parent2, _scopeId) => {
          if (_push2) {
            _push2(`<div class="mt-2"${_scopeId}>`);
            if (current_weather.loaded) {
              _push2(`<p class="m-0 font-light text-xl text-center flex items-center justify-center"${_scopeId}><img${ssrRenderAttr("src", current_weather.now.icon)} width="50"${_scopeId}> ${ssrInterpolate(current_weather.now.data)}</p>`);
            } else {
              _push2(`<p class="m-0 font-light text-sm text-center flex items-center justify-center"${_scopeId}>Loading weather data... </p>`);
            }
            _push2(`</div><div class="h-full w-full absolute inset-0 -z-10"${_scopeId}><img class="world-img"${ssrRenderAttr("src", _imports_0)}${_scopeId}></div>`);
          } else {
            return [
              createVNode("div", { class: "mt-2" }, [
                current_weather.loaded ? (openBlock(), createBlock("p", {
                  key: 0,
                  class: "m-0 font-light text-xl text-center flex items-center justify-center"
                }, [
                  createVNode("img", {
                    src: current_weather.now.icon,
                    width: "50"
                  }, null, 8, ["src"]),
                  createTextVNode(" " + toDisplayString(current_weather.now.data), 1)
                ])) : (openBlock(), createBlock("p", {
                  key: 1,
                  class: "m-0 font-light text-sm text-center flex items-center justify-center"
                }, "Loading weather data... "))
              ]),
              createVNode("div", { class: "h-full w-full absolute inset-0 -z-10" }, [
                createVNode("img", {
                  class: "world-img",
                  src: _imports_0
                })
              ])
            ];
          }
        }),
        _: 1
      }, _parent));
    };
  }
};
const _sfc_setup$3 = _sfc_main$3.setup;
_sfc_main$3.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("components/CurrentWeather.vue");
  return _sfc_setup$3 ? _sfc_setup$3(props, ctx) : void 0;
};
const __nuxt_component_5 = _sfc_main$3;
const _sfc_main$2 = {};
function _sfc_ssrRender(_ctx, _push, _parent, _attrs) {
  const _component_Card = __nuxt_component_0$1;
  _push(ssrRenderComponent(_component_Card, mergeProps({
    colSpan: "md:col-span-1",
    rowSpan: "md:row-span-2"
  }, _attrs), {
    default: withCtx((_, _push2, _parent2, _scopeId) => {
      if (_push2) {
        _push2(`<div class="flex justify-between w-full items-start mb-2"${_scopeId}><div class="flex flex-col"${_scopeId}><h2${_scopeId}>Now</h2></div><span class="relative flex h-3 w-3"${_scopeId}><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"${_scopeId}></span><span class="relative inline-flex rounded-full h-3 w-3 bg-green-500"${_scopeId}></span></span></div><p class="text-xs"${_scopeId}>Currently working at <a href="https://formability.eu" target="_blank"${_scopeId}>Formability</a></p>`);
      } else {
        return [
          createVNode("div", { class: "flex justify-between w-full items-start mb-2" }, [
            createVNode("div", { class: "flex flex-col" }, [
              createVNode("h2", null, "Now")
            ]),
            createVNode("span", { class: "relative flex h-3 w-3" }, [
              createVNode("span", { class: "animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" }),
              createVNode("span", { class: "relative inline-flex rounded-full h-3 w-3 bg-green-500" })
            ])
          ]),
          createVNode("p", { class: "text-xs" }, [
            createTextVNode("Currently working at "),
            createVNode("a", {
              href: "https://formability.eu",
              target: "_blank"
            }, "Formability")
          ])
        ];
      }
    }),
    _: 1
  }, _parent));
}
const _sfc_setup$2 = _sfc_main$2.setup;
_sfc_main$2.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("components/Currently.vue");
  return _sfc_setup$2 ? _sfc_setup$2(props, ctx) : void 0;
};
const __nuxt_component_6 = /* @__PURE__ */ _export_sfc(_sfc_main$2, [["ssrRender", _sfc_ssrRender]]);
const _sfc_main$1 = {
  __name: "Copyright",
  __ssrInlineRender: true,
  setup(__props) {
    return (_ctx, _push, _parent, _attrs) => {
      const _component_Card = __nuxt_component_0$1;
      _push(ssrRenderComponent(_component_Card, mergeProps({
        colSpan: "md:col-span-1",
        rowSpan: "md:row-span-2"
      }, _attrs), {
        default: withCtx((_, _push2, _parent2, _scopeId) => {
          if (_push2) {
            _push2(`<p class="text-xs mt-3"${_scopeId}> Forked with \u2665\uFE0F by Andrea Puglisi using <a href="https://nuxt.com/" target="_blank" class="text-red-500"${_scopeId}>Nuxt</a> from <a href="https://gianmarco.xyz/" target="_blank" class="text-red-500"${_scopeId}>Gianmarco Cavallo</a>. \xA9 ${ssrInterpolate(unref(moment)().format("Y"))}</p>`);
          } else {
            return [
              createVNode("p", { class: "text-xs mt-3" }, [
                createTextVNode(" Forked with \u2665\uFE0F by Andrea Puglisi using "),
                createVNode("a", {
                  href: "https://nuxt.com/",
                  target: "_blank",
                  class: "text-red-500"
                }, "Nuxt"),
                createTextVNode(" from "),
                createVNode("a", {
                  href: "https://gianmarco.xyz/",
                  target: "_blank",
                  class: "text-red-500"
                }, "Gianmarco Cavallo"),
                createTextVNode(". \xA9 " + toDisplayString(unref(moment)().format("Y")), 1)
              ])
            ];
          }
        }),
        _: 1
      }, _parent));
    };
  }
};
const _sfc_setup$1 = _sfc_main$1.setup;
_sfc_main$1.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("components/Copyright.vue");
  return _sfc_setup$1 ? _sfc_setup$1(props, ctx) : void 0;
};
const __nuxt_component_7 = _sfc_main$1;
const _sfc_main = {
  __name: "index",
  __ssrInlineRender: true,
  setup(__props) {
    ref([]);
    useSeoMeta({
      title: "Andrea Puglisi - Software Developer in Italy",
      ogTitle: "Andrea Puglisi - Software Developer in Italy",
      description: "Hello! I am Andrea and this is my website \u{1F642}.",
      ogDescription: "Hello! I am Andrea and this is my website \u{1F642}.",
      ogImage: "./me/me1.png",
      twitterCard: "./me/me1.png"
    });
    return (_ctx, _push, _parent, _attrs) => {
      const _component_Intro = __nuxt_component_0;
      const _component_About = __nuxt_component_1;
      const _component_Contact = __nuxt_component_2;
      const _component_TimeZone = __nuxt_component_3;
      const _component_Blog = __nuxt_component_4;
      const _component_CurrentWeather = __nuxt_component_5;
      const _component_Currently = __nuxt_component_6;
      const _component_Copyright = __nuxt_component_7;
      _push(`<!--[-->`);
      _push(ssrRenderComponent(_component_Intro, null, null, _parent));
      _push(ssrRenderComponent(_component_About, null, null, _parent));
      _push(ssrRenderComponent(_component_Contact, null, null, _parent));
      _push(ssrRenderComponent(_component_TimeZone, null, null, _parent));
      _push(ssrRenderComponent(_component_Blog, null, null, _parent));
      _push(ssrRenderComponent(_component_CurrentWeather, null, null, _parent));
      _push(ssrRenderComponent(_component_Currently, null, null, _parent));
      _push(ssrRenderComponent(_component_Copyright, null, null, _parent));
      _push(`<!--]-->`);
    };
  }
};
const _sfc_setup = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("pages/index.vue");
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};

export { _sfc_main as default };
//# sourceMappingURL=index-fdfe2b1e.mjs.map
