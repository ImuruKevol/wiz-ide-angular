import EditorManager from '@wiz/service/editor';
import { OnInit, Input } from '@angular/core';
import toastr from "toastr";
import MonacoEditor from "@wiz/app/season.monaco";

toastr.options = {
    "closeButton": false,
    "debug": false,
    "newestOnTop": true,
    "progressBar": false,
    "positionClass": "toast-bottom-right",
    "preventDuplicates": true,
    "onclick": null,
    "showDuration": 300,
    "hideDuration": 500,
    "timeOut": 1500,
    "extendedTimeOut": 1000,
    "showEasing": "swing",
    "hideEasing": "linear",
    "showMethod": "fadeIn",
    "hideMethod": "fadeOut"
};

export class Component implements OnInit {
    @Input() scope: any;

    public APP_ID: string = wiz.namespace;
    public items: any = [];

    constructor(private editorManager: EditorManager) {
    }

    public async ngOnInit() {
        await this.load();
    }

    public active(item: EditorManager.Editor) {
        let em = this.editorManager;
        if (!em.activated) return '';
        if (this.APP_ID != em.activated.component_id) return '';
        if (item.path != em.activated.path) return '';
        return 'active';
    }

    public async load() {
        this.items = [
            { title: 'App Module', subtitle: 'app.module', path: 'angular/app/app.module.ts', lang: 'typescript' },
            { title: 'App Routing', subtitle: 'app-routing.module', path: 'angular/app/app-routing.module.ts', lang: 'typescript' },
            {
                title: 'App UI', subtitle: 'app.component', path: 'angular',
                files: [
                    { name: 'index', path: 'angular/index.pug', lang: 'pug' },
                    { name: 'app-root', path: 'angular/app/app.component.pug', lang: 'pug' },
                    { name: 'component', path: 'angular/app/app.component.ts', lang: 'typescript' },
                    { name: 'scss', path: 'angular/app/app.component.scss', lang: 'scss' }
                ]
            },
            { title: 'Build Options', subtitle: 'app.component', path: 'angular/angular.build.options.json', lang: 'json' },
            { title: 'Wiz Class', subtitle: 'wiz.ts', path: 'angular/wiz.ts', lang: 'typescript' }
        ];

        await this.scope.render();
    }

    private async update(path: string, data: string) {
        let res = await wiz.call('update', { path: path, code: data });
        if (res.code != 200) return;
        toastr.success("Updated");
        res = await wiz.call('build', { path: path });
        if (res.code == 200) toastr.info("Build Finish");
        else toastr.error("Error on build");
    }

    public async open(item: any) {
        let editor = this.editorManager.create({
            component_id: this.APP_ID,
            path: item.path,
            title: item.title,
            subtitle: item.subtitle,
            unique: item.files ? false : true,
            current: 0
        });

        let createTab = (path: string, lang: string, name: string = "code") => {
            let monaco: any = { language: lang };
            if (lang == 'typescript') monaco.renderValidationDecorations = 'off';

            editor.create({
                name: name,
                viewref: MonacoEditor,
                path: path,
                config: { monaco }
            }).bind('data', async (tab) => {
                let { code, data } = await wiz.call('data', { path: tab.path });
                if (code != 200) return {};
                return { data };
            }).bind('update', async (tab) => {
                let data = await tab.data();
                await this.update(tab.path, data.data);
            });
        }

        if (!item.files) {
            createTab(item.path, item.lang);
        } else {
            for (let i = 0; i < item.files.length; i++) {
                createTab(item.files[i].path, item.files[i].lang, item.files[i].name);
            }
        }

        await editor.open();
    }
}