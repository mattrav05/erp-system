// Script to fix mobile responsiveness issues in table components
const fs = require('fs')
const path = require('path')

const files = [
  'components/estimates/edit-estimate-quickbooks-style.tsx',
  'components/inventory/inventory-adjustments.tsx',
  'components/sales-orders/sales-orders-list.tsx',
  'components/data-tools/export-wizard.tsx'
]

files.forEach(filePath => {
  const fullPath = path.join(process.cwd(), filePath)

  if (fs.existsSync(fullPath)) {
    let content = fs.readFileSync(fullPath, 'utf8')

    // Replace min-w-[1000px] with responsive solution
    content = content.replace(/min-w-\[1000px\]/g, '" style={{ minWidth: "800px" }}')

    // Replace min-w-max with responsive solution
    content = content.replace(/min-w-max/g, '" style={{ minWidth: "800px" }}')

    // Improve overflow containers
    content = content.replace(
      /<div className="overflow-x-auto">/g,
      '<div className="overflow-x-auto -mx-2 sm:mx-0">\n              <div className="inline-block min-w-full align-middle px-2 sm:px-0">'
    )

    // Add closing divs where needed (this is approximate, may need manual adjustment)
    content = content.replace(
      /<\/table>\s*<\/div>/g,
      '</table>\n              </div>\n            </div>'
    )

    fs.writeFileSync(fullPath, content)
    console.log(`✅ Fixed mobile responsiveness in ${filePath}`)
  } else {
    console.log(`⚠️  File not found: ${filePath}`)
  }
})

console.log('Mobile table fixes complete!')