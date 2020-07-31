require 'bundler/inline'

gemfile do
  source 'https://rubygems.org'
  gem 'nokogiri', '~> 1.10.1'
end

class SiteMapGenerator
  def items
    posts = Dir.glob('./_posts/*.md').map do |item|
      File.basename(item, '.md').split('-')[3..-1].join('-')
    end
    books = Dir.glob('./_books/*.md').map do |item|

    end
    posts + books
  end

  def url(item)
    "https://jer-k.github.io/#{item}/"
  end

  def generate_xml
    builder = Nokogiri::XML::Builder.new do |xml|
      xml.urlset(xmlns: 'http://www.sitemaps.org/schemas/sitemap/0.9') do
        items.each do |item|
          xml.url do
            xml.loc_ url(item)
          end
        end
      end
    end

    builder.to_xml(save_with: Nokogiri::XML::Node::SaveOptions::AS_XML)
  end

  def write(xml)
    File.open('sitemap.xml', 'w') {|file| file << xml }
  end

  def run
    site_map = generate_xml
    write(site_map)
  end
end

SiteMapGenerator.new.run
