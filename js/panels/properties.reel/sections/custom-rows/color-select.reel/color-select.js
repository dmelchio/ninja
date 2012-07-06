/* <copyright>
Copyright (c) 2012, Motorola Mobility, Inc
All Rights Reserved.
BSD License.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

  - Redistributions of source code must retain the above copyright notice,
    this list of conditions and the following disclaimer.
  - Redistributions in binary form must reproduce the above copyright
    notice, this list of conditions and the following disclaimer in the
    documentation and/or other materials provided with the distribution.
  - Neither the name of Motorola Mobility nor the names of its contributors
    may be used to endorse or promote products derived from this software
    without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE
LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
POSSIBILITY OF SUCH DAMAGE.
</copyright> */

var Montage = require("montage/core/core").Montage;
var Component = require("montage/ui/component").Component;

exports.ColorSelect = Montage.create(Component, {

    Stroke: {
        value: null
    },

    Fill: {
        value: null
    },

    strokeChip: {
        value: null
    },

    fillChip: {
        value: null
    },

    handleChange: {
        value: function(e) {

        }
    },

    colorVisible: {
        value: true
    },

    color2Visible: {
        value: true
    },

    divider: {
        value: false
    },

    prepareForDraw: {
        value: function() {
            if (this.divider) {
                this.element.appendChild(document.createElement("hr"));
            }
            if (!this.colorVisible) {
                this.Stroke.style.display = "none";
            }

            if (!this.color2Visible) {
                this.Fill.style.display = "none";
            }

//            for (var i = 0; i < this.options.length; i ++ ) {
//                var tmpOption = new Option();
//                tmpOption.text = this.options[i].name;
//                tmpOption.value = this.options[i].value;
//                if (i === this.selectedIndex) tmpOption.selected = true
//                this.options[i].name = this.element.getElementsByTagName("select")[0].add(tmpOption);
//            }

        }
    },

    destroy: {
        value: function() {
            if(this.strokeChip)
            {
                this.strokeChip.destroy();
            }
            if(this.fillChip)
            {
                this.fillChip.destroy();
            }
        }
    }

});
