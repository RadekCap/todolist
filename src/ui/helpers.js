/**
 * Populate a <select> element with options from an array of items
 * @param {HTMLSelectElement} selectEl - The select element to populate
 * @param {Array} items - Array of objects to create options from
 * @param {Object} [options] - Configuration options
 * @param {string} [options.emptyLabel='No selection'] - Label for the empty/default option
 * @param {string} [options.labelKey='name'] - Property name to use for option text
 * @param {string} [options.valueKey='id'] - Property name to use for option value
 */
export function populateSelectOptions(selectEl, items, { emptyLabel = 'No selection', labelKey = 'name', valueKey = 'id' } = {}) {
    selectEl.innerHTML = ''
    const emptyOption = document.createElement('option')
    emptyOption.value = ''
    emptyOption.textContent = emptyLabel
    selectEl.appendChild(emptyOption)

    items.forEach(item => {
        const option = document.createElement('option')
        option.value = item[valueKey]
        option.textContent = item[labelKey]
        selectEl.appendChild(option)
    })
}
